// Batch narrative adapter. Same injection contract as ./narrative but takes
// a list of (score, candidate) pairs and returns a Map keyed by program_id.
// Per-item post-filter ensures each surviving narrative cites only known
// source_ids; rejected items are reported so the caller can fall back to
// template-rendered narratives for them.

import type { Candidate, Score } from "../../schemas/index";
import { getModel } from "../config";
import { filterNarrative } from "../post-filter";
import {
    BATCH_SYSTEM_PROMPT,
    BatchNarrativeSchema,
    buildBatchUserPrompt,
} from "../prompts/recommendation-narrative-batch";
import type {
    Locale,
    RecommendationNarrative,
} from "../prompts/recommendation-narrative";
import { err, ok, type AIError, type Result } from "../result";
import type { GenerateObjectFn } from "./narrative";

export interface BatchAdapterInput {
    readonly locale: Locale;
    readonly items: ReadonlyArray<{
        readonly score: Score;
        readonly candidate: Candidate;
    }>;
    readonly generate: GenerateObjectFn;
}

export interface BatchAdapterOutput {
    readonly narratives: ReadonlyMap<string, RecommendationNarrative>;
    readonly rejected: ReadonlyArray<{
        readonly program_id: string;
        readonly reason: string;
    }>;
}

export async function generateBatchNarratives(
    input: BatchAdapterInput,
): Promise<Result<BatchAdapterOutput, AIError>> {
    const { locale, items, generate } = input;

    if (items.length === 0) {
        return ok({ narratives: new Map(), rejected: [] });
    }

    const promptItems = items.map(({ score, candidate }) => {
        if (score.program_id !== candidate.program.id) {
            throw new Error(
                `score / candidate mismatch for program ${score.program_id}`,
            );
        }
        return {
            program_id: score.program_id,
            university_id: score.university_id,
            program_name: candidate.program.name_en,
            university_name: candidate.university.name_en,
            band: score.band,
            final_score: score.final_score,
            reasons: score.reasons.flatMap((r) =>
                r.sources.map((s) => ({ text: r.text, source_id: s.source_id })),
            ),
        };
    });

    const userPrompt = buildBatchUserPrompt({ locale, items: promptItems });

    let raw: unknown;
    try {
        const response = await generate({
            model: getModel("narrative"),
            system: BATCH_SYSTEM_PROMPT,
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

    const parsed = BatchNarrativeSchema.safeParse(raw);
    if (!parsed.success) {
        return err({
            kind: "validation_failed",
            message: parsed.error.message,
        });
    }

    const sourceIdsByProgram = new Map<string, Set<string>>();
    for (const { score, candidate } of items) {
        const ids = new Set<string>([
            ...candidate.program.sources.map((s) => s.source_id),
            ...candidate.university.sources.map((s) => s.source_id),
            ...score.reasons.flatMap((r) => r.sources.map((s) => s.source_id)),
        ]);
        sourceIdsByProgram.set(score.program_id, ids);
    }

    const narratives = new Map<string, RecommendationNarrative>();
    const rejected: Array<{ program_id: string; reason: string }> = [];

    for (const narrative of parsed.data.narratives) {
        const known = sourceIdsByProgram.get(narrative.program_id);
        if (!known) {
            rejected.push({
                program_id: narrative.program_id,
                reason: "program_id not in input batch",
            });
            continue;
        }
        const filtered = filterNarrative(narrative, known);
        if (!filtered.ok) {
            rejected.push({
                program_id: narrative.program_id,
                reason: filtered.error.message,
            });
            continue;
        }
        narratives.set(narrative.program_id, filtered.value);
    }

    // Any input program with no output entry counts as rejected so the
    // caller knows which slots need a template fallback.
    for (const { score } of items) {
        if (!narratives.has(score.program_id)) {
            const already = rejected.some(
                (r) => r.program_id === score.program_id,
            );
            if (!already) {
                rejected.push({
                    program_id: score.program_id,
                    reason: "missing from LLM response",
                });
            }
        }
    }

    return ok({ narratives, rejected });
}
