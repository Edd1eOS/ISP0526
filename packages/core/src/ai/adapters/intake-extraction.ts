// Intake extraction adapter. Same injection contract as ./narrative — the
// caller passes a `generate` closure that wraps the Vercel AI SDK (or a
// stub in tests). The adapter parses the model output with the strict Zod
// schema and additionally drops any field whose confidence is below a
// configurable floor so downstream UI can trust what it receives.

import { getModel } from "../config";
import {
    ExtractedProfileSchema,
    INTAKE_EXTRACTION_SYSTEM_PROMPT,
    buildExtractionUserPrompt,
    type ExtractedProfile,
    type Locale,
} from "../prompts/intake-extraction";
import { err, ok, type AIError, type Result } from "../result";
import type { GenerateObjectFn } from "./narrative";

export const DEFAULT_CONFIDENCE_FLOOR = 0.4;

export interface ExtractionAdapterInput {
    readonly locale: Locale;
    readonly text: string;
    readonly generate: GenerateObjectFn;
    readonly confidenceFloor?: number;
}

export async function extractProfileFromText(
    input: ExtractionAdapterInput,
): Promise<Result<ExtractedProfile, AIError>> {
    const { locale, text, generate } = input;
    const floor = input.confidenceFloor ?? DEFAULT_CONFIDENCE_FLOOR;

    if (text.trim().length === 0) {
        return err({
            kind: "validation_failed",
            message: "source text is empty",
        });
    }

    const userPrompt = buildExtractionUserPrompt({ locale, text });

    let raw: unknown;
    try {
        const response = await generate({
            model: getModel("extraction"),
            system: INTAKE_EXTRACTION_SYSTEM_PROMPT,
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

    const parsed = ExtractedProfileSchema.safeParse(raw);
    if (!parsed.success) {
        return err({
            kind: "validation_failed",
            message: parsed.error.message,
        });
    }

    if (process.env.NODE_ENV !== "production") {
        // reason: developer-only diagnostic so we can see what the LLM
        // actually returned before the confidence floor strips fields.
        // eslint-disable-next-line no-console
        console.info(
            "[intake-extraction] raw fields:",
            JSON.stringify(parsed.data),
        );
    }

    return ok(applyConfidenceFloor(parsed.data, floor));
}

function applyConfidenceFloor(
    extracted: ExtractedProfile,
    floor: number,
): ExtractedProfile {
    const academic: ExtractedProfile["academic"] = {};
    for (const [k, v] of Object.entries(extracted.academic)) {
        if (v && v.confidence >= floor) {
            // reason: index signature is structurally compatible; the cast
            // keeps the per-key value types intact.
            (academic as Record<string, unknown>)[k] = v;
        }
    }

    const budget: ExtractedProfile["budget"] = {};
    for (const [k, v] of Object.entries(extracted.budget)) {
        if (v && v.confidence >= floor) {
            (budget as Record<string, unknown>)[k] = v;
        }
    }

    return {
        academic,
        budget,
        unstructured_notes: extracted.unstructured_notes,
    };
}
