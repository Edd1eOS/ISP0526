"use server";

import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { redirect } from "next/navigation";
import { StudentProfileSchema, type StudentProfile } from "@isp0526/core";
import { isGoogleConfigured } from "../../lib/ai/google-narrative";
import { runReportFromProfile } from "../../lib/run-report";
import {
    ClarifyPatchSchema,
    type ClarifyPatch,
    type FormFieldKey,
} from "../intake-clarify/clarify-schema";
import {
    buildChatIntakeSystemPrompt,
    CHAT_PRIORITY,
    MIN_SUPPORTING_SIGNALS,
} from "./chat-prompt";

const MODEL_ID = process.env.GOOGLE_TEXT_MODEL_ID ?? "gemini-2.5-flash";
const MAX_MESSAGES = 24;

const ChatTurnSchema = z
    .object({
        reply: z.string().min(1).max(400),
        patch: ClarifyPatchSchema.optional(),
        quick_replies: z.array(z.string().min(1).max(24)).max(4).optional(),
        done: z.boolean(),
    })
    .strict();

export interface ChatMessage {
    readonly role: "user" | "assistant";
    readonly content: string;
}

export interface ChatTurnInput {
    readonly messages: ReadonlyArray<ChatMessage>;
    readonly accumulated: ClarifyPatch;
}

export interface ChatTurnResult {
    readonly ok: boolean;
    readonly reply?: string;
    readonly patch?: ClarifyPatch;
    readonly quickReplies?: ReadonlyArray<string>;
    readonly done?: boolean;
    readonly degraded?: boolean;
    readonly error?: string;
}

function computeMissing(
    accumulated: ClarifyPatch,
): ReadonlyArray<FormFieldKey> {
    return CHAT_PRIORITY.filter((k) => {
        const v = (accumulated as Record<string, unknown>)[k];
        if (v === undefined || v === null) return true;
        if (Array.isArray(v) && v.length === 0) return true;
        if (typeof v === "string" && v.trim() === "") return true;
        return false;
    });
}

function fallbackQuestion(
    missing: ReadonlyArray<FormFieldKey>,
    extracted?: ClarifyPatch,
): ChatTurnResult {
    if (missing.length === 0) {
        return {
            ok: true,
            reply: "信息我都记下了，去给你拉推荐了。",
            patch: extracted,
            done: true,
            degraded: true,
        };
    }
    const next = missing[0]!;
    const map: Record<FormFieldKey, { q: string; qr?: string[] }> = {
        target_level: {
            q: "你想去读什么学位？",
            qr: ["硕士", "本科", "博士"],
        },
        target_field: {
            q: "想读哪个方向？比如计算机、商科、工程、设计……都可以。",
        },
        annual_budget_aud: {
            q: "一年大概能花多少？学费 + 生活都算上。",
            qr: ["20万人民币", "30万人民币", "40万人民币", "还在看"],
        },
        preferred_tags: {
            q: "你最看重哪一项？",
            qr: ["好就业", "性价比", "想留下来", "顶尖学校"],
        },
        gpa: { q: "GPA 大概多少？（4 分制）" },
        ielts_overall: { q: "雅思有成绩了吗？总分多少？" },
        teaching_style: {
            q: "上课风格偏理论还是偏实践？",
            qr: ["偏理论", "都行", "偏实践"],
        },
        city_size: {
            q: "城市规模上你倾向？",
            qr: ["超大城市", "大城市", "中等就行", "小城市"],
        },
    };
    const cfg = map[next];
    return {
        ok: true,
        reply: cfg.q,
        patch: extracted,
        quickReplies: cfg.qr,
        done: false,
        degraded: true,
    };
}

// Heuristic patch extractor used by the deterministic fallback. The LLM
// normally handles this; in degraded mode we cover the most common quick-
// reply phrasings so the conversation can still progress.
function extractPatchHeuristic(
    last: string | undefined,
    accumulated: ClarifyPatch,
): ClarifyPatch | undefined {
    if (!last) return undefined;
    const t = last.trim();
    const patch: Record<string, unknown> = {};

    if (!accumulated.target_level) {
        if (/(硕士|master|研究生)/i.test(t)) patch.target_level = "master";
        else if (/(本科|bachelor|学士)/i.test(t)) patch.target_level = "bachelor";
        else if (/(博士|phd|doctor)/i.test(t)) patch.target_level = "phd";
    }

    if (!accumulated.city_size) {
        if (/超大|悉尼|墨尔本/.test(t)) patch.city_size = "mega";
        else if (/大城市/.test(t)) patch.city_size = "large";
        else if (/中等/.test(t)) patch.city_size = "medium";
        else if (/小城市|小镇/.test(t)) patch.city_size = "small";
    }

    if (!accumulated.teaching_style) {
        if (/偏理论|理论/.test(t)) patch.teaching_style = "theory_heavy";
        else if (/偏实践|实践|动手/.test(t)) patch.teaching_style = "applied_heavy";
        else if (/都行|都可以|无所谓|均衡/.test(t)) patch.teaching_style = "balanced";
    }

    const tags: string[] = [...(accumulated.preferred_tags ?? [])];
    const addTag = (x: string) => {
        if (!tags.includes(x)) tags.push(x);
    };
    if (/好就业|就业|工作机会/.test(t)) addTag("career_pipeline");
    if (/性价比|便宜|划算/.test(t)) addTag("value_for_money");
    if (/想留下|移民|留澳|留下来/.test(t)) addTag("migration_friendly");
    if (/顶尖|名校|排名|顶级/.test(t)) addTag("field_top");
    if (/奖学金/.test(t)) addTag("scholarship_rich");
    if (/华人|中国人|社区/.test(t)) addTag("chinese_community");
    if (tags.length !== (accumulated.preferred_tags?.length ?? 0)) {
        patch.preferred_tags = tags;
    }

    if (accumulated.gpa === undefined) {
        const m = t.match(/(?:gpa\s*[:：]?\s*)?(\d(?:\.\d{1,2})?)\s*(?:\/|分)?/i);
        if (m) {
            const v = Number(m[1]);
            if (v >= 0 && v <= 4 && /gpa|分|绩点|\d\.\d/i.test(t)) patch.gpa = v;
        }
    }

    if (accumulated.ielts_overall === undefined) {
        const m = t.match(/(?:雅思|ielts)[^\d]{0,6}(\d(?:\.\d)?)/i);
        if (m) {
            const v = Number(m[1]);
            if (v >= 0 && v <= 9) patch.ielts_overall = v;
        }
    }

    if (accumulated.annual_budget_aud === undefined) {
        // Match patterns like "20万人民币", "30万", "5万澳", "50000 aud".
        const cny = t.match(/(\d+(?:\.\d+)?)\s*万\s*(?:人民币|rmb|cny)?/i);
        const aud = t.match(/(\d+(?:\.\d+)?)\s*万\s*(?:澳|aud)/i);
        const audPlain = t.match(/(\d{4,6})\s*(?:aud|澳元)/i);
        if (aud) {
            patch.annual_budget_aud = Math.round(Number(aud[1]) * 10000);
        } else if (cny) {
            patch.annual_budget_aud = Math.round(
                (Number(cny[1]) * 10000) / 4.7,
            );
        } else if (audPlain) {
            patch.annual_budget_aud = Number(audPlain[1]);
        }
    }

    // target_field: very loose — let the user type anything; map a few keywords.
    if (!accumulated.target_field) {
        const map: Array<[RegExp, string]> = [
            [/数据|data\s*science/i, "Data Science"],
            [/计算机|cs|computer/i, "Computing"],
            [/it/i, "IT"],
            [/金融|finance/i, "Finance"],
            [/商科|商|business|mba/i, "Business"],
            [/土木|civil/i, "Civil Engineering"],
            [/电气|电子|electrical/i, "Electrical Engineering"],
            [/机械|mechanical/i, "Mechanical Engineering"],
            [/设计|design/i, "Design"],
            [/tesol|英语教学/i, "TESOL"],
        ];
        for (const [re, val] of map) {
            if (re.test(t)) {
                patch.target_field = val;
                break;
            }
        }
    }

    return Object.keys(patch).length > 0 ? (patch as ClarifyPatch) : undefined;
}

export async function chatIntakeTurnAction(
    input: ChatTurnInput,
): Promise<ChatTurnResult> {
    const lastUser = [...input.messages]
        .reverse()
        .find((m) => m.role === "user")?.content;
    const heuristic = extractPatchHeuristic(lastUser, input.accumulated);
    const effectiveAccum: ClarifyPatch = heuristic
        ? { ...input.accumulated, ...heuristic }
        : input.accumulated;
    const missing = computeMissing(effectiveAccum);

    if (!isGoogleConfigured()) {
        return fallbackQuestion(missing, heuristic);
    }

    const trimmed = input.messages.slice(-MAX_MESSAGES);
    const system = buildChatIntakeSystemPrompt({
        accumulated: input.accumulated,
        missingKeys: missing,
    });

    try {
        const { object } = await generateObject({
            model: google(MODEL_ID),
            schema: ChatTurnSchema,
            system,
            messages:
                trimmed.length === 0
                    ? [{ role: "user", content: "(开始)" }]
                    : trimmed.map((m) => ({
                          role: m.role,
                          content: m.content,
                      })),
        });

        // Apply done-gate server-side: even if the LLM sets done=true, refuse
        // when we do not have target_level + MIN_SUPPORTING_SIGNALS yet,
        // unless the latest user message explicitly says they want to stop.
        const merged = mergePatch(input.accumulated, object.patch);
        const finalDone =
            object.done &&
            (canFinalize(merged) || userRequestedStop(trimmed));

        return {
            ok: true,
            reply: object.reply,
            patch: object.patch,
            quickReplies: object.quick_replies,
            done: finalDone,
        };
    } catch (cause) {
        // eslint-disable-next-line no-console
        console.warn(
            "[intake-chat] LLM failed, using deterministic fallback:",
            cause instanceof Error ? cause.message : String(cause),
        );
        return fallbackQuestion(missing, heuristic);
    }
}

function mergePatch(
    base: ClarifyPatch,
    next: ClarifyPatch | undefined,
): ClarifyPatch {
    if (!next) return base;
    return { ...base, ...next };
}

function canFinalize(p: ClarifyPatch): boolean {
    if (!p.target_level) return false;
    let signals = 0;
    if (p.target_field) signals += 1;
    if (p.annual_budget_aud) signals += 1;
    if (p.preferred_tags && p.preferred_tags.length > 0) signals += 1;
    if (p.gpa !== undefined) signals += 1;
    if (p.ielts_overall !== undefined) signals += 1;
    if (p.teaching_style) signals += 1;
    if (p.city_size) signals += 1;
    return signals >= MIN_SUPPORTING_SIGNALS;
}

function userRequestedStop(messages: ReadonlyArray<ChatMessage>): boolean {
    const last = messages[messages.length - 1];
    if (!last || last.role !== "user") return false;
    const t = last.content.trim();
    return /^(够了|可以了|就这样|直接看推荐|不聊了|好了|看推荐)/.test(t);
}

// Promote a chat-derived patch into a full StudentProfile, applying safe
// defaults for anything the chat did not capture. target_level defaults to
// "master" because that is the only level with seed program data today.
function patchToProfile(p: ClarifyPatch): StudentProfile {
    return StudentProfileSchema.parse({
        academic: {
            target_level: p.target_level ?? "master",
            target_field: p.target_field,
            gpa: p.gpa,
            ielts_overall: p.ielts_overall,
        },
        learning: p.teaching_style ? { teaching_style: p.teaching_style } : {},
        lifestyle: p.city_size ? { city_size: p.city_size } : {},
        career: {},
        budget: {
            flex: 0,
            ...(p.annual_budget_aud
                ? { annual_aud: p.annual_budget_aud }
                : {}),
        },
        preferred_tags: p.preferred_tags ?? [],
    });
}

export async function finalizeChatIntakeAction(
    accumulated: ClarifyPatch,
): Promise<void> {
    const profile = patchToProfile(accumulated);
    const { code } = await runReportFromProfile(profile);
    redirect(`/r/${code}`);
}
