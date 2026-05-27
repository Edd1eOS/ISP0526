// Wish-parse prompt.
//
// Called when the student types in the free-input astrolabe during the
// star-chart picking phase. The model tries to:
//   1. Extract any structured intake fields that are stated clearly enough
//      to write into the KnowledgeLedger (source = "wish", low priority).
//   2. Return a single clarifying follow-up question (≤ 80 chars) that the
//      UI displays above the textarea to guide deeper input.
//
// Confidence bar is intentionally HIGH: the model must omit an extracted
// field if there is any reasonable ambiguity. It is better to ask than
// to silently corrupt a pick the student made on the star chart.
//
// STRICT RULES:
//   - Do not invent universities, fees, IELTS thresholds, or visa rules.
//   - Do not include extracted fields the student hasn't clearly stated.
//   - followUp must be a concise, non-pushy question (≤ 80 chars), or null.
//   - Output JSON exactly matching the schema. No prose outside JSON.

import { z } from "zod";
import type { Locale } from "./recommendation-narrative";

export const TAG_VALUES = [
    "field_top",
    "migration_friendly",
    "career_pipeline",
    "value_for_money",
    "scholarship_rich",
    "chinese_community",
] as const;

export const WishExtractedSchema = z
    .object({
        target_level: z.enum(["bachelor", "master", "phd"]).optional(),
        /** Must be one of: Computing, Business, Design, Data Science, TESOL.
         *  Omit if the field doesn't map cleanly to any of these. */
        target_field: z.string().max(40).optional(),
        city_size: z.enum(["mega", "large", "medium", "small"]).optional(),
        /** AUD per year, rounded to nearest 5000. */
        annual_budget_aud: z
            .number()
            .int()
            .min(10000)
            .max(250000)
            .optional(),
        teaching_style: z
            .enum(["theory_heavy", "balanced", "applied_heavy"])
            .optional(),
        preferred_tags: z.array(z.enum(TAG_VALUES)).max(6).optional(),
    })
    .optional();

export type WishExtracted = z.infer<typeof WishExtractedSchema>;

export const CLEARABLE_FIELDS = [
    "target_level",
    "target_field",
    "annual_budget_aud",
    "city_size",
    "teaching_style",
    "preferred_tags",
] as const;

export type ClearableField = (typeof CLEARABLE_FIELDS)[number];

export const WishParseResultSchema = z.object({
    /** Structured fields extracted from the wish text with high confidence.
     *  Absent or empty object when nothing clear enough was found. */
    extracted: WishExtractedSchema,
    /** Direct factual answer (≤ 120 chars) when the student asked a question
     *  (e.g. "what does AUD mean?", "why is it in Australian dollars?").
     *  Null when the student made a statement or expressed preference. */
    answer: z.string().min(4).max(120).nullable(),
    /** A single clarifying follow-up question (≤ 80 chars) to help the
     *  student decide — or null when no follow-up is needed. When `answer`
     *  is non-null, `followUp` should typically be null. */
    followUp: z.string().min(4).max(80).nullable(),
    /** Fields to retract when the student expresses regret or second-thoughts
     *  about a prior answer (e.g. "我还没想好专业", "I changed my mind on
     *  the city size"). The engine will re-ask those questions. */
    clearFields: z.array(z.enum(CLEARABLE_FIELDS)).optional(),
});

export type WishParseResult = z.infer<typeof WishParseResultSchema>;

export interface WishParsePromptInput {
    readonly locale: Locale;
    readonly wishText: string;
    /** Current known facts, for context (e.g. to avoid redundant follow-ups). */
    readonly currentFacts?: Readonly<Record<string, string>>;
    /** The question currently on screen, so the LLM understands the context. */
    readonly currentQuestionContext?: string;
}

export const WISH_PARSE_SYSTEM_PROMPT = [
    "You are a study-abroad counsellor embedded in a web intake form.",
    "A student has typed a free-form note while filling in their profile.",
    "Your FOUR tasks (apply ALL that fit):",
    "",
    "1. ANSWER — if the student asks a factual question (e.g. 'what does",
    "   AUD mean?', 'why Australian dollars?', 'what is a bachelor?'),",
    "   answer it directly in `answer` (≤ 120 chars, same language as the",
    "   student). Set `followUp` to null when `answer` is set.",
    "   Key fact: AUD = Australian Dollar (澳大利亚元, NOT 澳门元).",
    "   Do NOT invent fees, rankings, or visa rules.",
    "",
    "2. GUIDE — if the student expresses confusion or uncertainty (e.g.",
    "   '没想好', 'not sure'), set `answer` to null and return a short",
    "   guiding question in `followUp` (≤ 80 chars) that helps them",
    "   narrow down their thinking. Do not ask something already known.",
    "",
    "3. BACKTRACK — if the student expresses regret, doubt, or correction",
    "   about a field they already answered (e.g. '我还没想好专业',",
    "   'I changed my mind about city', '其实预算搞错了'), set `clearFields`",
    "   to the array of affected field names. Also set `answer` to a short",
    "   reassurance like '好，帮你回到专业选择' (≤ 60 chars).",
    "   Field names: target_level, target_field, annual_budget_aud,",
    "   city_size, teaching_style, preferred_tags.",
    "",
    "4. EXTRACT — extract structured fields ONLY when stated clearly.",
    "   Valid target_field values: Computing, Business, Design,",
    "   Data Science, TESOL. Omit any field you are not sure about.",
    "",
    "STRICT RULES:",
    "- Never invent universities, fees, IELTS scores, or visa rules.",
    "- answer and followUp are mutually exclusive (set the other to null).",
    "- clearFields can accompany an answer (the reassurance message).",
    "- Output JSON exactly matching the schema. No prose outside JSON.",
].join("\n");

export function buildWishParsePrompt(input: WishParsePromptInput): string {
    const lang = input.locale === "en" ? "English" : "Simplified Chinese";
    const lines: string[] = [];
    lines.push(`Respond in ${lang}.`);
    if (input.currentQuestionContext) {
        lines.push(`Current screen question: ${input.currentQuestionContext}`);
    }
    if (input.currentFacts && Object.keys(input.currentFacts).length > 0) {
        lines.push("Already known facts (do not re-extract these):");
        for (const [k, v] of Object.entries(input.currentFacts)) {
            lines.push(`  ${k}: ${v}`);
        }
    }
    lines.push("");
    lines.push("Student's free note:");
    const capped =
        input.wishText.length > 400
            ? `${input.wishText.slice(0, 400)}…`
            : input.wishText;
    lines.push(capped);
    return lines.join("\n");
}
