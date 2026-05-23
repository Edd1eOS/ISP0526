// Narrative adapter. Wraps the LLM call so the rest of the codebase only
// depends on (Score, Candidate, Locale) -> Result<Narrative>. The actual
// model invocation is injected via the `generate` function so we can swap in
// the Vercel AI SDK at deployment time and stub it in tests.

import type { Candidate, Score } from "../../schemas/index";
import { getModel } from "../config";
import { filterNarrative } from "../post-filter";
import {
    RecommendationNarrativeSchema,
    SYSTEM_PROMPT,
    buildUserPrompt,
    type Locale,
    type RecommendationNarrative,
} from "../prompts/recommendation-narrative";
import { err, ok, type AIError, type Result } from "../result";

export interface GenerateObjectArgs {
    readonly model: string;
    readonly system: string;
    readonly prompt: string;
}

export type GenerateObjectFn = (
    args: GenerateObjectArgs,
) => Promise<{ readonly object: unknown }>;

export interface NarrativeAdapterInput {
    readonly score: Score;
    readonly candidate: Candidate;
    readonly locale: Locale;
    readonly generate: GenerateObjectFn;
}

export async function generateRecommendationNarrative(
    input: NarrativeAdapterInput,
): Promise<Result<RecommendationNarrative, AIError>> {
    const { score, candidate, locale, generate } = input;

    if (score.program_id !== candidate.program.id) {
        return err({
            kind: "validation_failed",
            message: "score and candidate refer to different programs",
        });
    }

    const reasons = score.reasons.flatMap((r) =>
        r.sources.map((s) => ({ text: r.text, source_id: s.source_id })),
    );

    const userPrompt = buildUserPrompt({
        locale,
        program_id: score.program_id,
        university_id: score.university_id,
        program_name: candidate.program.name_en,
        university_name: candidate.university.name_en,
        band: score.band,
        final_score: score.final_score,
        reasons,
    });

    let raw: unknown;
    try {
        const response = await generate({
            model: getModel("narrative"),
            system: SYSTEM_PROMPT,
            prompt: userPrompt,
        });
        raw = response.object;
    } catch (cause) {
        return err({
            kind: "generation_failed",
            message: cause instanceof Error ? cause.message : "unknown error",
            cause,
        });
    }

    const parsed = RecommendationNarrativeSchema.safeParse(raw);
    if (!parsed.success) {
        return err({
            kind: "validation_failed",
            message: parsed.error.message,
        });
    }

    const knownSourceIds = new Set<string>([
        ...candidate.program.sources.map((s) => s.source_id),
        ...candidate.university.sources.map((s) => s.source_id),
        // Rule citations are emitted by the aggregator and are always valid.
        ...score.reasons.flatMap((r) => r.sources.map((s) => s.source_id)),
    ]);

    return filterNarrative(parsed.data, knownSourceIds);
}

export { ok };
