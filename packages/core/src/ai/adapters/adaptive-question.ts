// Adaptive-question adapter. Follows the wish-parse pattern.

import { getModel } from "../config";
import {
    ADAPTIVE_QUESTION_SYSTEM_PROMPT,
    AdaptiveQuestionResultSchema,
    buildAdaptiveQuestionPrompt,
    type AdaptiveQuestionPromptInput,
    type AdaptiveQuestionResult,
} from "../prompts/adaptive-question";
import { err, ok, type AIError, type Result } from "../result";
import type { GenerateObjectFn } from "./narrative";

export interface AdaptiveQuestionAdapterInput extends AdaptiveQuestionPromptInput {
    readonly generate: GenerateObjectFn;
}

export async function generateAdaptiveQuestion(
    input: AdaptiveQuestionAdapterInput,
): Promise<Result<AdaptiveQuestionResult, AIError>> {
    const userPrompt = buildAdaptiveQuestionPrompt(input);
    let raw: unknown;
    try {
        const response = await input.generate({
            model: getModel("narrative"),
            system: ADAPTIVE_QUESTION_SYSTEM_PROMPT,
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
    const parsed = AdaptiveQuestionResultSchema.safeParse(raw);
    if (!parsed.success) {
        return err({
            kind: "validation_failed",
            message: parsed.error.message,
            cause: parsed.error,
        });
    }
    return ok(parsed.data);
}
