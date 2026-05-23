// Deterministic clarify fallback. When the LLM is unavailable (quota
// exhausted, network error, missing API key) the chat must still drive the
// student to a filled-out form. This module provides a tiny rule-based
// "interviewer" that picks the next priority question and does best-effort
// keyword extraction on the student's plain-text reply.
//
// It is intentionally dumb: substring matching, regex for numbers, fixed
// question text. The point is to keep the demo walking when Gemini sleeps.

import type {
    ClarifyPatch,
    FormFieldKey,
} from "./clarify-schema";

export interface FallbackTurnInput {
    readonly messages: ReadonlyArray<{ role: "user" | "assistant"; content: string }>;
    readonly missingKeys: ReadonlyArray<FormFieldKey>;
}

export interface FallbackTurnResult {
    readonly reply: string;
    readonly patch?: ClarifyPatch;
    readonly done: boolean;
}

// Last user message is the answer to whatever assistant asked previously.
// We track which question was just asked by looking at the trailing
// assistant message; map it back to a field key via a hidden marker.
const MARKER_RE = /\[\[ask:(\w+)\]\]$/;

function appendMarker(text: string, key: FormFieldKey): string {
    return `${text}\n\n[[ask:${key}]]`;
}

function stripMarker(text: string): string {
    return text.replace(MARKER_RE, "").trim();
}

function lastAsked(
    messages: ReadonlyArray<{ role: string; content: string }>,
): FormFieldKey | undefined {
    for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i];
        if (m.role !== "assistant") continue;
        const hit = MARKER_RE.exec(m.content);
        if (hit) return hit[1] as FormFieldKey;
        return undefined;
    }
    return undefined;
}

function lastUser(
    messages: ReadonlyArray<{ role: string; content: string }>,
): string {
    for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === "user") return messages[i].content;
    }
    return "";
}

// --- per-field interpreters ---------------------------------------------

function parseTargetField(text: string): string | undefined {
    const t = text.toLowerCase();
    // engineering family
    if (/土木|civil/.test(text)) return "Civil Engineering";
    if (/电气|电子|electrical/.test(text)) return "Electrical Engineering";
    if (/机械|mechanical/.test(text)) return "Mechanical Engineering";
    if (/工程|engineering/.test(text)) return "Civil Engineering"; // sane default
    if (/数据|data/.test(text)) return "Data Science";
    if (/it|信息技术|资讯/.test(t)) return "Information Technology";
    if (/计算机|cs|computing|comp\s*sci/.test(t)) return "Computing";
    if (/金融|finance/.test(text)) return "Finance";
    if (/mba|工商管理/.test(t)) return "Business Administration";
    if (/商|business|commerce/.test(t)) return "Business";
    if (/设计|design/.test(text)) return "Design";
    if (/tesol|英语教学|英语老师/.test(t)) return "TESOL";
    return undefined;
}

function parseNumber(text: string): number | undefined {
    // Handle Chinese "万": 20万 -> 200000, 3.5万 -> 35000
    const wan = /(\d+(?:\.\d+)?)\s*万/.exec(text);
    if (wan) return Math.round(parseFloat(wan[1]) * 10000);
    const plain = /(\d+(?:\.\d+)?)/.exec(text);
    if (plain) return parseFloat(plain[1]);
    return undefined;
}

function parseBudget(text: string): number | undefined {
    const n = parseNumber(text);
    if (n === undefined) return undefined;
    // Detect explicit CNY/RMB to convert (rough 4.7x rate).
    if (/人民币|rmb|cny|￥/.test(text.toLowerCase())) {
        return Math.round(n / 4.7);
    }
    // Treat as AUD by default. Sanity clamp.
    if (n < 1000) return undefined;
    if (n > 500000) return 500000;
    return Math.round(n);
}

function parseGpa(text: string): number | undefined {
    const n = parseNumber(text);
    if (n === undefined) return undefined;
    if (n > 4 && n <= 5) return Math.round((n / 5) * 4 * 100) / 100;
    if (n > 5 && n <= 100) return Math.round((n / 100) * 4 * 100) / 100;
    if (n >= 0 && n <= 4) return n;
    return undefined;
}

function parseIelts(text: string): number | undefined {
    const n = parseNumber(text);
    if (n === undefined || n < 0 || n > 9) return undefined;
    return n;
}

function parseTeachingStyle(
    text: string,
): "theory_heavy" | "balanced" | "applied_heavy" | undefined {
    if (/^1$|理论|学术|research/i.test(text)) return "theory_heavy";
    if (/^2$|平衡|都行|balanced/i.test(text)) return "balanced";
    if (/^3$|实践|应用|动手|applied|practical/i.test(text)) return "applied_heavy";
    return undefined;
}

function parseCitySize(
    text: string,
): "mega" | "large" | "medium" | "small" | undefined {
    if (/^1$|超大|悉尼|sydney|墨尔本|melbourne|大都市/i.test(text)) return "mega";
    if (/^2$|大城市|brisbane|布里斯班|perth|珀斯/i.test(text)) return "large";
    if (/^3$|中等|adelaide|阿德莱德/i.test(text)) return "medium";
    if (/^4$|小城|乡村|town|small/i.test(text)) return "small";
    return undefined;
}

function parseTags(text: string): string[] | undefined {
    const tags = new Set<string>();
    if (/学科|顶尖|top|排名|强|world.class/i.test(text)) tags.add("field_top");
    if (/移民|留下|prr?|pr|permanent/i.test(text)) tags.add("migration_friendly");
    if (/就业|工作|实习|career|job/i.test(text)) tags.add("career_pipeline");
    if (/性价比|便宜|cheap|value|划算/i.test(text)) tags.add("value_for_money");
    if (/奖学金|scholarship/i.test(text)) tags.add("scholarship_rich");
    if (/华人|中国人|chinese.community/i.test(text)) tags.add("chinese_community");
    // numeric multi-choice 1-6
    const nums = text.match(/[1-6]/g) ?? [];
    const numTags = ["field_top","migration_friendly","career_pipeline","value_for_money","scholarship_rich","chinese_community"];
    for (const d of nums) tags.add(numTags[parseInt(d, 10) - 1]);
    return tags.size > 0 ? Array.from(tags) : undefined;
}

function parseTargetLevel(
    text: string,
): "bachelor" | "master" | "phd" | undefined {
    if (/本科|学士|undergrad|bachelor/i.test(text)) return "bachelor";
    if (/硕士|master|研究生/i.test(text)) return "master";
    if (/博士|phd|doctor/i.test(text)) return "phd";
    return undefined;
}

// --- question bank -------------------------------------------------------

const QUESTIONS: Record<FormFieldKey, string> = {
    target_field:
        "先确认下专业方向：你提到想学的是工程的话，更偏土木、电气还是机械？也可以直接说 IT、数据、商科、金融、MBA、设计、TESOL 之一。",
    annual_budget_aud:
        "预算想留多少？给个一年全包数字（学费+生活）就行，比如「6 万 AUD」或「20 万人民币」我都能换算。",
    preferred_tags:
        "你最看重哪两三点？可以直接说，或者报数字（多选）：1 学科顶尖 / 2 利于移民 / 3 就业渠道 / 4 性价比 / 5 奖学金 / 6 华人社区。",
    gpa: "顺便问下 GPA 大概多少？按 4 分制说就行（也可以告诉我百分制，我帮你换）。",
    ielts_overall: "雅思总分考了吗？没考也可以说「没考」。",
    teaching_style:
        "你喜欢哪种上课风格？1 偏理论 / 2 理论与应用平衡 / 3 偏实践。",
    city_size:
        "想去什么规模的城市？1 超大（悉尼/墨尔本）/ 2 大城市（布里斯班/珀斯）/ 3 中等（阿德莱德等）/ 4 小城市。",
    target_level: "目标学位是？本科 / 硕士 / 博士。",
};

// --- main entry ----------------------------------------------------------

export function runDeterministicTurn(
    input: FallbackTurnInput,
): FallbackTurnResult {
    const patch: Mutable<ClarifyPatch> = {};
    const asked = lastAsked(input.messages);
    const userAnswer = lastUser(input.messages);

    // If the previous assistant message asked about a specific field,
    // try to interpret the user's reply for that field.
    if (asked && userAnswer) {
        applyAnswer(asked, userAnswer, patch);
    }

    // Recompute missing after applying patch. Caller-supplied missingKeys
    // is post-patch by the time we're reading it, but the new patch might
    // have filled the field they were just asked about — so skip the asked
    // key from the next question pick.
    const remaining = input.missingKeys.filter((k) => k !== asked || !(k in patch));

    if (remaining.length === 0) {
        return {
            reply:
                "都聊清楚了，下方按钮就能出报告。还想改任何字段，直接编辑右边表单就行。",
            patch: Object.keys(patch).length > 0 ? patch : undefined,
            done: true,
        };
    }

    const nextKey = remaining[0];
    const question = QUESTIONS[nextKey];
    return {
        reply: appendMarker(question, nextKey),
        patch: Object.keys(patch).length > 0 ? patch : undefined,
        done: false,
    };
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

function applyAnswer(
    key: FormFieldKey,
    answer: string,
    patch: Mutable<ClarifyPatch>,
): void {
    switch (key) {
        case "target_field": {
            const v = parseTargetField(answer);
            if (v) patch.target_field = v;
            break;
        }
        case "annual_budget_aud": {
            const v = parseBudget(answer);
            if (v !== undefined) patch.annual_budget_aud = v;
            break;
        }
        case "preferred_tags": {
            const v = parseTags(answer);
            if (v) {
                // reason: parseTags returns plain string[] from a closed enum
                // set, type-narrowed by the schema enum at runtime.
                patch.preferred_tags = v as ClarifyPatch["preferred_tags"];
            }
            break;
        }
        case "gpa": {
            const v = parseGpa(answer);
            if (v !== undefined) patch.gpa = v;
            break;
        }
        case "ielts_overall": {
            const v = parseIelts(answer);
            if (v !== undefined) patch.ielts_overall = v;
            break;
        }
        case "teaching_style": {
            const v = parseTeachingStyle(answer);
            if (v) patch.teaching_style = v;
            break;
        }
        case "city_size": {
            const v = parseCitySize(answer);
            if (v) patch.city_size = v;
            break;
        }
        case "target_level": {
            const v = parseTargetLevel(answer);
            if (v) patch.target_level = v;
            break;
        }
    }
}

export { stripMarker };
