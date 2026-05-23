// Recommendation narrative prompt.
//
// Inputs: one scored candidate plus the structured reasons emitted by the
// rule engine. The LLM's only job is to rephrase those reasons into a short
// Chinese or English narrative. It MUST NOT introduce facts that are not
// already in the input. Post-filter then validates citation source_ids.

import { z } from "zod";
import { ProgramIdSchema, UniversityIdSchema } from "../../schemas/ids.js";

export const LocaleSchema = z.enum(["zh", "en"]);
export type Locale = z.infer<typeof LocaleSchema>;

export const NarrativePointSchema = z.object({
    text: z.string().min(4).max(160),
    source_id: z.string().min(1),
});
export type NarrativePoint = z.infer<typeof NarrativePointSchema>;

export const RecommendationNarrativeSchema = z.object({
    program_id: ProgramIdSchema,
    university_id: UniversityIdSchema,
    locale: LocaleSchema,
    headline: z.string().min(8).max(80),
    summary: z.string().min(40).max(600),
    pros: z.array(NarrativePointSchema).min(2).max(5),
    cons: z.array(NarrativePointSchema).max(3),
});
export type RecommendationNarrative = z.infer<typeof RecommendationNarrativeSchema>;

export const SYSTEM_PROMPT = `You translate structured recommendation reasons into a short narrative for a student.

Hard rules:
- You MUST NOT introduce any fact that is not present in the user message.
- Every pros/cons entry MUST cite one source_id taken verbatim from the input.
- Tone: warm, factual, no marketing language, no emoji.
- Output language follows the "locale" field exactly (zh = Simplified Chinese, en = English).
- The summary is a single paragraph (no lists).`;

export interface NarrativePromptInput {
    readonly locale: Locale;
    readonly program_id: string;
    readonly university_id: string;
    readonly program_name: string;
    readonly university_name: string;
    readonly band: "stretch" | "match" | "safety";
    readonly final_score: number;
    readonly reasons: ReadonlyArray<{ readonly text: string; readonly source_id: string }>;
}

export function buildUserPrompt(input: NarrativePromptInput): string {
    const reasonLines = input.reasons
        .map((r, i) => `  ${i + 1}. [source_id=${r.source_id}] ${r.text}`)
        .join("\n");
    return [
        `locale: ${input.locale}`,
        `program_id: ${input.program_id}`,
        `university_id: ${input.university_id}`,
        `program: ${input.program_name}`,
        `university: ${input.university_name}`,
        `band: ${input.band}`,
        `final_score: ${input.final_score}`,
        `reasons:\n${reasonLines}`,
    ].join("\n");
}
