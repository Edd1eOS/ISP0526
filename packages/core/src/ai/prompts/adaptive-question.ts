// Adaptive intake question generator.
//
// Called after the two required pickers (学习阶段 + 方向) and their
// level-specific supplement are complete. The LLM decides what to ask
// next based on the student's individual context — no hardcoded question
// list.
//
// Design constraints:
//   - Max 10 main questions total (counting the fixed pickers).
//     Fixed questions account for ~3, leaving ~7 adaptive turns.
//   - When the student is sufficiently characterised, return done=true.
//   - Each question must come with 2-6 quickPicks so the student can
//     respond with one tap. The WishInput textarea is still available
//     for free-form elaboration.
//   - Never re-ask facts already captured (passed in `knownFacts`).
//   - Never invent facts (universities, fees, visa rules, IELTS thresholds).
//   - Focus on information that genuinely differentiates program fit:
//     budget range, city preference, academic background signals,
//     motivation, career goals, special constraints (visa, family, etc.).

import { z } from "zod";
import type { Locale } from "./recommendation-narrative";

export const AdaptiveQuestionResultSchema = z.object({
    /** True when enough information has been gathered; question/quickPicks will be null. */
    done: z.boolean(),
    /** The question text to display (≤ 100 chars). Null when done=true. */
    question: z.string().min(4).max(100).nullable(),
    /** 2-6 concise tap-to-answer options (each ≤ 30 chars). Null when done=true. */
    quickPicks: z.array(z.string().min(1).max(30)).min(2).max(6).nullable(),
    /** True if the student may select multiple quick-picks (e.g. country/region selection). */
    multiSelect: z.boolean().optional(),
});

export type AdaptiveQuestionResult = z.infer<typeof AdaptiveQuestionResultSchema>;

export interface ConversationTurnInput {
    readonly question: string;
    readonly answer: string;
}

export interface AdaptiveQuestionPromptInput {
    readonly locale: Locale;
    /** Structured facts already known (field, level, budget already answered, etc.). */
    readonly knownFacts?: Readonly<Record<string, string>>;
    /** Prior Q&A turns from the adaptive phase. */
    readonly history: ReadonlyArray<ConversationTurnInput>;
    /** How many main questions have been asked so far (fixed + adaptive). */
    readonly questionCount: number;
    readonly maxQuestions: number;
    /** RIASEC scores 0..1 from the personality assessment, if available. */
    readonly riasec?: Readonly<Partial<Record<
        "realistic" | "investigative" | "artistic" | "social" | "enterprising" | "conventional",
        number
    >>>;
    /** Free text notes the student has typed in the astrolabe input. */
    readonly freeNotes?: string;
}

export const ADAPTIVE_QUESTION_SYSTEM_PROMPT = [
    "You are a study-abroad intake advisor helping a student plan their international",
    "university application. Our database covers 15 countries/regions: AU, US, UK, CA, NZ,",
    "HK (Hong Kong SAR), SG, MY, TH, DE, NL, IE, RU, TW (Taiwan), MO (Macao SAR).",
    "Note: HK, TW, MO are regions, not independent countries — always use '地区' not '国家' for them.",
    "Your task: ask the SINGLE most useful question to help match them to the right program.",
    "",
    "STRICT MINIMUM BEFORE DECLARING DONE:",
    "- You MUST ask at least 2 questions total before declaring done",
    "  (questionCount < 2 → done=false always, even if you think you know enough).",
    "- questionCount >= maxQuestions always forces done=true.",
    "",
    "QUESTION PRIORITY ORDER (ask the first unknown item):",
    "1. preferred_countries — if not in knownFacts AND freeNotes does not clearly state",
    "   countries. Ask which country/region the student is considering.",
    "   IMPORTANT: set multiSelect: true for this question so the student can pick multiple.",
    "   quickPicks should list the most popular clusters:",
    "   '仅澳大利亚', '英国 / 爱尔兰', '美国 / 加拿大', '新加坡 / 港澳', '德国 / 荷兰',",
    "   '都可以 / 还没想好'",
    "   (Adapt labels to the student's field — e.g. DE/NL for engineering, SG for finance).",
    "",
    "2. annual_budget_aud — if not in knownFacts AND not mentioned in freeNotes.",
    "   Frame as '年度留学预算（学费 + 生活费）' — do NOT say 'AUD' in the question.",
    "   quickPicks should cover the realistic range for the student's target countries:",
    "   If countries include DE/NL (low tuition), bias toward lower ranges.",
    "   If countries include US/UK/AU, bias toward higher ranges.",
    "   Examples: '15 万以内', '20–30 万', '30–40 万', '40–50 万', '50 万以上'",
    "",
    "3. Career outcome or post-study intent — always ask once even if city is known.",
    "   '毕业后你最希望做什么?' Tailor quickPicks to target countries:",
    "   If AU/NZ/CA: include '当地就业 / 移民'.",
    "   If UK/IE: include '英国就业'.",
    "   If HK/SG: include '留港/留新就业'.",
    "   Always include '回国发展' and '继续深造' as options.",
    "",
    "4. city_size — if not in knownFacts.",
    "   '你倾向哪种规模的城市？'",
    "   quickPicks: '超大城市（首都/一线）', '大城市', '中型大学城', '无偏好'",
    "",
    "5. Academic background signal — only if level=master/phd.",
    "   Ask about GPA range or exam score type (高考/GPA/A-level/etc.).",
    "",
    "6. Hard constraint — visa sponsorship, proximity to family, scholarship required.",
    "   Only ask if no constraint has been mentioned.",
    "",
    "7. For PhD: research topic or target lab.",
    "",
    "QUESTION PERSONALISATION RULES:",
    "- If RIASEC shows artistic ≥ 0.7: lean toward UK/IE for design/arts programs.",
    "- If RIASEC shows investigative ≥ 0.7 + level=phd: bias toward US/UK/AU research.",
    "- If target_field=Computing or data: highlight SG/AU tech hubs in country picks.",
    "- If target_field=Business: highlight HK/SG/UK in country picks.",
    "- If budget is low (< 20万) and countries unknown: suggest DE/NL (low/no tuition).",
    "",
    "NEVER ask about:",
    "- target_level or target_field (already answered in the fixed pickers).",
    "- Any field already listed in knownFacts.",
    "- Anything the student answered in history or mentioned in freeNotes.",
    "",
    "quickPicks: 2-6 concise options (each ≤ 30 chars) realistic for this student.",
    "Respond in the language specified by locale.",
    "Output JSON only — no prose outside JSON.",
].join("\n");

export function buildAdaptiveQuestionPrompt(
    input: AdaptiveQuestionPromptInput,
): string {
    const lang = input.locale === "en" ? "English" : "Simplified Chinese";
    const lines: string[] = [];
    lines.push(`Respond in ${lang}.`);
    lines.push(`questionCount: ${input.questionCount} / maxQuestions: ${input.maxQuestions}`);

    if (input.knownFacts && Object.keys(input.knownFacts).length > 0) {
        lines.push("Known facts (do not re-ask):");
        for (const [k, v] of Object.entries(input.knownFacts)) {
            lines.push(`  ${k}: ${v}`);
        }
    }

    if (input.riasec && Object.keys(input.riasec).length > 0) {
        const top = Object.entries(input.riasec)
            .sort(([, a], [, b]) => (b ?? 0) - (a ?? 0))
            .slice(0, 3)
            .map(([k, v]) => `${k}=${((v ?? 0) * 100).toFixed(0)}%`)
            .join(", ");
        lines.push(`RIASEC top dims: ${top}`);
    }

    if (input.history.length > 0) {
        lines.push("Prior Q&A:");
        for (const turn of input.history) {
            lines.push(`  Q: ${turn.question}`);
            lines.push(`  A: ${turn.answer}`);
        }
    }

    if (input.freeNotes?.trim()) {
        lines.push("Student free notes:");
        lines.push(`  ${input.freeNotes.trim().slice(0, 300)}`);
    }

    lines.push("");
    lines.push(
        input.questionCount >= input.maxQuestions
            ? "You have reached the question limit. Return done=true."
            : "What is the single most valuable question to ask next?",
    );

    return lines.join("\n");
}
