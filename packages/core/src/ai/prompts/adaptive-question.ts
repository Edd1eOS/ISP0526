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
    "You are an intake advisor helping a student plan their Australian university application.",
    "Your task: ask the SINGLE most useful question to help match them to the right university.",
    "",
    "STRICT MINIMUM BEFORE DECLARING DONE:",
    "- You MUST ask about annual budget (AUD/year) if `annual_budget_aud` is not in",
    "  knownFacts AND the student has not mentioned a dollar amount in freeNotes.",
    "  Budget is the #1 filter in program matching. Do NOT skip it.",
    "- You MUST ask at least 2 questions total before declaring done",
    "  (i.e. questionCount < 2 means done=false always, even if you think you know enough).",
    "- questionCount >= maxQuestions always forces done=true.",
    "",
    "QUESTION PRIORITY ORDER (ask the first one that is still unknown):",
    "1. annual_budget_aud — if not in knownFacts (MANDATORY first question if missing).",
    "2. city_size — if not in knownFacts.",
    "3. Career outcome or motivation — 'after graduation, what do you want to do?'",
    "   (always valuable, ask once even if city is known).",
    "4. Academic background signal — GPA range, exam score — only if level=master/phd.",
    "5. Hard constraint — visa sponsorship need, proximity to family, scholarship required.",
    "6. For PhD: research topic or target lab.",
    "",
    "NEVER ask about:",
    "- target_level or target_field (already answered in the fixed pickers before this phase).",
    "- Any field already listed in knownFacts.",
    "- Anything the student answered in history or mentioned in freeNotes.",
    "",
    "quickPicks: 2-6 concise options realistic for this student's context.",
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
