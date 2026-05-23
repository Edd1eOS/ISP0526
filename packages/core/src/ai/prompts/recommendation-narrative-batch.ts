// Batch variant of the recommendation narrative prompt.
//
// Rationale: free-tier hosted LLM providers (e.g. Google Gemini free tier
// at ~10 RPM) cannot handle one HTTP call per program in a single user
// session. We pack all programs from one report into a single call and
// receive an array of narratives back, then validate per-item.
//
// The per-item schema is reused verbatim from ./recommendation-narrative
// so post-filter / Zod parsing logic stays identical.

import { z } from "zod";
import {
    RecommendationNarrativeSchema,
    type Locale,
} from "./recommendation-narrative";

export const BatchNarrativeSchema = z.object({
    narratives: z.array(RecommendationNarrativeSchema).min(1).max(30),
});
export type BatchNarrative = z.infer<typeof BatchNarrativeSchema>;

export const BATCH_SYSTEM_PROMPT = `You translate structured recommendation reasons into short narratives for a student.

You will receive a list of N candidate programs. For each candidate you produce one narrative entry. Return EXACTLY N entries in the same order as the input.

Hard rules:
- You MUST NOT introduce any fact that is not present in the user message.
- Every pros/cons entry MUST cite one source_id taken verbatim from that candidate's reasons.
- Tone: warm, factual, no marketing language, no emoji.
- Output language follows the top-level "locale" field exactly (zh = Simplified Chinese, en = English).
- Each summary is a single paragraph (no lists).
- Preserve the input program_id and university_id in each output entry verbatim.`;

export interface BatchItemInput {
    readonly program_id: string;
    readonly university_id: string;
    readonly program_name: string;
    readonly university_name: string;
    readonly band: "stretch" | "match" | "safety";
    readonly final_score: number;
    readonly reasons: ReadonlyArray<{
        readonly text: string;
        readonly source_id: string;
    }>;
}

export interface BatchPromptInput {
    readonly locale: Locale;
    readonly items: ReadonlyArray<BatchItemInput>;
}

export function buildBatchUserPrompt(input: BatchPromptInput): string {
    const blocks = input.items.map((item, idx) => {
        const reasonLines = item.reasons
            .map(
                (r, i) =>
                    `    ${i + 1}. [source_id=${r.source_id}] ${r.text}`,
            )
            .join("\n");
        return [
            `--- candidate ${idx + 1} ---`,
            `program_id: ${item.program_id}`,
            `university_id: ${item.university_id}`,
            `program: ${item.program_name}`,
            `university: ${item.university_name}`,
            `band: ${item.band}`,
            `final_score: ${item.final_score}`,
            `reasons:\n${reasonLines}`,
        ].join("\n");
    });
    return [
        `locale: ${input.locale}`,
        `count: ${input.items.length}`,
        "",
        ...blocks,
    ].join("\n");
}
