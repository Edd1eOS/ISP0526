"use server";

import { generateText, Output } from "ai";
import { redirect } from "next/navigation";
import {
    extractProfileFromText,
    StudentProfileSchema,
    type ExtractedProfile,
    type StudentProfile,
} from "@isp0526/core";
import {
    getTextModel,
    isGoogleConfigured,
    isLLMConfigured,
} from "../../lib/ai/google-narrative";
import { buildGoogleExtractionGenerator } from "../../lib/ai/google-extraction";
import { enrichExtraction } from "../../lib/ai/intake-enricher";
import { runReportFromProfile } from "../../lib/run-report";
import {
    scoreAssessment,
    type AssessmentAnswers,
} from "../assessment/items";
import {
    type ClarifyPatch,
    type FormFieldKey,
} from "../intake-clarify/clarify-schema";
import { FIELD_OPTIONS } from "../intake/field-options";
import {
    CHAT_PRIORITY,
    MIN_SUPPORTING_SIGNALS,
} from "./chat-prompt";
import {
    ConversationOutputSchema,
    buildConversationSystemPrompt,
} from "./chat-prompt-conversation";
import {
    ExtractionOutputSchema,
    buildExtractionSystemPrompt,
} from "./chat-prompt-extraction";
import {
    lockedKeys as computeLockedKeys,
    mergePatchDeep,
    nextPhase,
    sanitizePatch,
} from "./intake-state";

const MAX_MESSAGES = 24;

export interface ChatMessage {
    readonly role: "user" | "assistant";
    readonly content: string;
}

export interface ChatTurnInput {
    readonly messages: ReadonlyArray<ChatMessage>;
    readonly accumulated: ClarifyPatch;
    readonly assessment?: AssessmentAnswers;
}

export interface ChatTurnResult {
    readonly ok: boolean;
    readonly reply?: string;
    readonly patch?: ClarifyPatch;
    readonly quickReplies?: ReadonlyArray<string>;
    readonly inputMode?: "single" | "multi" | "number";
    readonly done?: boolean;
    readonly degraded?: boolean;
    readonly error?: string;
}

function computeMissing(
    accumulated: ClarifyPatch,
): ReadonlyArray<FormFieldKey> {
    const locked = new Set(computeLockedKeys(accumulated));
    return CHAT_PRIORITY.filter((k) => !locked.has(k));
}

// Used only when the LLM call itself fails (network / quota / schema). No
// per-mood, per-repeat branching — that was the "field matching" heuristic
// the product owner asked us to drop. We just surface the next priority
// gap with its preset chips so the user can still progress by tapping.
function fallbackQuestion(
    missing: ReadonlyArray<FormFieldKey>,
): ChatTurnResult {
    if (missing.length === 0) {
        return {
            ok: true,
            reply: "信息我都记下了，去给你拉推荐了。",
            done: true,
            degraded: true,
        };
    }
    const next = missing[0]!;
    const cfg = FIELD_FALLBACK_COPY[next];
    return {
        ok: true,
        reply: `AI 暂时叫不通，请直接点下面的按钮：${cfg.q}`,
        quickReplies: cfg.qr,
        done: false,
        degraded: true,
    };
}

// Field-specific defaults used by the LLM-failed fallback above. The LLM
// owns the happy path; this map is only the safety net.
const FIELD_FALLBACK_COPY: Record<FormFieldKey, { q: string; qr?: string[] }> =
{
    target_level: {
        q: "你想去读什么学位？",
        qr: ["硕士", "本科", "博士"],
    },
    target_field: {
        q: "想读哪个方向？",
        qr: ["计算机", "数据科学", "金融", "商科", "工程", "设计"],
    },
    preferred_tags: {
        q: "你最看重哪一项？",
        qr: ["好就业", "性价比", "想留下来", "顶尖学校"],
    },
    gpa: {
        q: "学业成绩告诉我个原始数据就行，什么体系都可以。",
        qr: ["高考分", "本科 GPA", "WAM", "A-level", "AP", "证书"],
    },
    ielts_overall: {
        q: "雅思总分大概多少？",
        qr: ["6.0", "6.5", "7.0+", "还没考"],
    },
    teaching_style: {
        q: "上课风格偏理论还是偏实践？",
        qr: ["偏理论", "都行", "偏实践"],
    },
    city_size: {
        q: "城市规模上你倾向？",
        qr: ["超大城市", "大城市", "中等就行", "小城市"],
    },
};

// NOTE: All heuristic field-matching logic was intentionally removed. The
// LLM owns extraction, repeat-avoidance, and skip-on-decline entirely. See
// the system prompt in ./chat-prompt.ts (rules 14-17). Keeping this file
// thin makes the LLM the single source of truth for chat behaviour.

export async function chatIntakeTurnAction(
    input: ChatTurnInput,
): Promise<ChatTurnResult> {
    const missing = computeMissing(input.accumulated);

    if (!isLLMConfigured()) {
        return fallbackQuestion(missing);
    }

    const trimmed = input.messages.slice(-MAX_MESSAGES);
    const scored = input.assessment
        ? scoreAssessment(input.assessment)
        : undefined;
    const hasUserMessage = trimmed.some((m) => m.role === "user");

    // ---- Stage 1: Extraction Agent (EA) ----
    // Only runs when the student actually said something this turn. Failure
    // is non-fatal: we treat the patch as empty and let CA still produce a
    // reply so the chat keeps moving.
    let cleanPatch: ClarifyPatch = {};
    if (hasUserMessage) {
        const lockedForEA = computeLockedKeys(input.accumulated);
        const lastUserMessage =
            [...trimmed].reverse().find((m) => m.role === "user")?.content ??
            "";
        const lastAssistantQuestion =
            [...trimmed]
                .reverse()
                .find((m) => m.role === "assistant")?.content ?? "";
        const extractionSystem = buildExtractionSystemPrompt({
            accumulated: input.accumulated,
            lockedKeys: lockedForEA,
            lastAssistantQuestion,
            lastUserMessage,
        });
        try {
            const { output } = await generateText({
                model: getTextModel(),
                output: Output.object({ schema: ExtractionOutputSchema }),
                system: extractionSystem,
                messages: [
                    {
                        role: "user",
                        content: lastUserMessage || "(empty)",
                    },
                ],
            });
            cleanPatch = sanitizePatch(input.accumulated, output.patch) ?? {};
        } catch (cause) {
            // eslint-disable-next-line no-console
            console.warn(
                "[intake-chat] extraction agent failed; continuing with empty patch:",
                cause instanceof Error ? cause.message : String(cause),
            );
        }
    }

    // Merge EA output BEFORE building the CA prompt so CA sees the latest
    // state and asks the next priority gap instead of repeating itself.
    const merged = mergePatchDeep(input.accumulated, cleanPatch);
    const lockedAfter = computeLockedKeys(merged);
    const missingAfter = CHAT_PRIORITY.filter(
        (k) => !new Set(lockedAfter).has(k),
    );
    const phase = nextPhase(merged, { hasUserMessage });

    // ---- Stage 2: Conversation Agent (CA) ----
    const conversationSystem = buildConversationSystemPrompt({
        accumulated: merged,
        missingKeys: missingAfter,
        lockedKeys: lockedAfter,
        phase,
        assessment: scored
            ? {
                big_five: scored.big_five,
                learning: scored.learning,
                lifestyle: scored.lifestyle,
                career: {
                    migration_intent: scored.career.migration_intent,
                    return_home: scored.career.return_home,
                    interests: scored.career.interests as
                        | Record<string, number>
                        | undefined,
                },
            }
            : undefined,
    });

    try {
        const { output } = await generateText({
            model: getTextModel(),
            output: Output.object({ schema: ConversationOutputSchema }),
            system: conversationSystem,
            messages:
                trimmed.length === 0
                    ? [{ role: "user", content: "(开始)" }]
                    : trimmed.map((m) => ({
                        role: m.role,
                        content: m.content,
                    })),
        });
        const finalDone =
            output.done &&
            hasUserMessage &&
            (canFinalize(merged) || userRequestedStop(trimmed));

        return {
            ok: true,
            reply: output.reply,
            patch: cleanPatch,
            quickReplies: output.quick_replies,
            inputMode: output.input_mode,
            done: finalDone,
        };
    } catch (cause) {
        const c = cause as Record<string, unknown> | null;
        // eslint-disable-next-line no-console
        console.warn(
            "[intake-chat] conversation agent failed, using chip-only fallback:",
            cause instanceof Error ? cause.message : String(cause),
            c && typeof c === "object"
                ? { statusCode: c.statusCode, url: c.url }
                : undefined,
        );
        // Preserve EA's progress even if CA fails — UI still merges patch.
        const fb = fallbackQuestion(missingAfter);
        return { ...fb, patch: cleanPatch };
    }
}

function canFinalize(p: ClarifyPatch): boolean {
    if (!p.target_level) return false;
    const skipped = new Set(p.skipped_fields ?? []);
    let signals = 0;
    if (p.target_field || skipped.has("target_field")) signals += 1;
    if (
        (p.preferred_tags && p.preferred_tags.length > 0) ||
        skipped.has("preferred_tags")
    )
        signals += 1;
    if (
        p.gpa !== undefined ||
        (p.credentials && p.credentials.length > 0) ||
        skipped.has("gpa")
    )
        signals += 1;
    if (p.ielts_overall !== undefined || skipped.has("ielts_overall"))
        signals += 1;
    if (p.teaching_style || skipped.has("teaching_style")) signals += 1;
    if (p.city_size || skipped.has("city_size")) signals += 1;
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
// When an assessment payload is provided, its scored output is merged into
// big_five / learning / lifestyle / career; assessment values take
// precedence over chat-only guesses on overlapping keys (teaching_style,
// city_size) because the assessment forces an explicit answer.
const ALL_COUNTRIES = [
    "AU", "US", "UK", "CA", "NZ", "HK", "SG", "MY", "TH",
    "DE", "NL", "IE", "RU", "TW", "MO",
] as const;

function patchToProfile(
    p: ClarifyPatch,
    assessment?: AssessmentAnswers,
): StudentProfile {
    const a = assessment ? scoreAssessment(assessment) : undefined;
    // When the student picked specific countries, exclude everything else.
    const preferredSet = new Set(p.preferred_countries ?? []);
    const excluded = preferredSet.size > 0
        ? ALL_COUNTRIES.filter((c) => !preferredSet.has(c))
        : [];
    return StudentProfileSchema.parse({
        academic: {
            target_level: p.target_level ?? "master",
            target_field: p.target_field,
            gpa: p.gpa,
            credentials: p.credentials ?? [],
            ielts_overall: p.ielts_overall,
        },
        ...(a ? { big_five: a.big_five } : {}),
        learning: {
            ...(p.teaching_style ? { teaching_style: p.teaching_style } : {}),
            ...(a?.learning ?? {}),
        },
        lifestyle: {
            ...(p.city_size ? { city_size: p.city_size } : {}),
            ...(a?.lifestyle ?? {}),
        },
        career: a?.career ?? {},
        budget: {
            flex: 0,
            ...(p.annual_budget_aud
                ? { annual_aud: p.annual_budget_aud }
                : {}),
        },
        preferred_tags: p.preferred_tags ?? [],
        hard_constraints: {
            excluded_countries: excluded,
            required_tags: [],
        },
    });
}

export async function finalizeChatIntakeAction(
    accumulated: ClarifyPatch,
    assessment?: AssessmentAnswers,
): Promise<void> {
    const profile = patchToProfile(accumulated, assessment);
    const { code } = await runReportFromProfile(profile);
    redirect(`/r/${code}`);
}

/* ---------------- Resume → ClarifyPatch (chat seeding) ----------------
 *
 * Used by the chat module when the student says "yes I have a resume" at
 * the opening gate. Runs the same Gemini extractor + regex enricher as the
 * upload flow, then maps the result onto the smaller ClarifyPatch shape so
 * the chat FSM can lock the corresponding fields and skip those questions.
 */

const MAX_RESUME_CHARS = 60_000;

export interface ResumeExtractResult {
    readonly ok: boolean;
    readonly patch?: ClarifyPatch;
    readonly filledKeys?: ReadonlyArray<FormFieldKey>;
    readonly llmUsed: boolean;
    readonly error?: string;
}

export async function extractResumeForChatAction(
    text: string,
): Promise<ResumeExtractResult> {
    const trimmed = (text ?? "").slice(0, MAX_RESUME_CHARS).trim();
    if (trimmed.length === 0) {
        return { ok: false, error: "empty text", llmUsed: false };
    }

    let extracted: ExtractedProfile = { academic: {}, budget: {} };
    let llmUsed = false;

    if (isGoogleConfigured()) {
        try {
            const r = await extractProfileFromText({
                locale: "zh",
                text: trimmed,
                generate: buildGoogleExtractionGenerator(),
            });
            if (r.ok) {
                extracted = r.value;
                llmUsed = true;
            } else {
                // eslint-disable-next-line no-console
                console.warn(
                    "[intake-chat] resume extraction soft-failed:",
                    r.error.kind,
                    r.error.message,
                );
            }
        } catch (cause) {
            // eslint-disable-next-line no-console
            console.warn(
                "[intake-chat] resume extraction threw; falling back to regex enricher only",
                cause,
            );
        }
    }

    const enriched = enrichExtraction(extracted, trimmed);
    const { patch, filledKeys } = extractedToClarifyPatch(enriched);
    return { ok: true, patch, filledKeys, llmUsed };
}

function matchFieldEnum(aiValue: string): string | undefined {
    const q = aiValue.toLowerCase().trim();
    if (!q) return undefined;
    for (const opt of FIELD_OPTIONS) {
        if (!opt.value) continue;
        const v = opt.value.toLowerCase();
        const l = opt.label.toLowerCase();
        if (v.includes(q) || q.includes(v) || l.includes(q)) {
            return opt.value;
        }
    }
    return undefined;
}

function extractedToClarifyPatch(extracted: ExtractedProfile): {
    patch: ClarifyPatch;
    filledKeys: ReadonlyArray<FormFieldKey>;
} {
    const patch: Record<string, unknown> = {};
    const filled: FormFieldKey[] = [];
    const a = extracted.academic;
    const b = extracted.budget;

    if (a.target_level) {
        patch.target_level = a.target_level.value;
        filled.push("target_level");
    }
    if (a.target_field) {
        const mapped = matchFieldEnum(a.target_field.value);
        if (mapped) {
            patch.target_field = mapped;
            filled.push("target_field");
        }
    }
    if (a.gpa) {
        patch.gpa = a.gpa.value;
        filled.push("gpa");
    }
    if (a.ielts_overall) {
        patch.ielts_overall = a.ielts_overall.value;
        filled.push("ielts_overall");
    }
    if (b.annual_aud) {
        patch.annual_budget_aud = b.annual_aud.value;
    }

    return { patch: patch as ClarifyPatch, filledKeys: filled };
}

