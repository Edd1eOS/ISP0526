// Implication bullets adapter. Mirrors star-diagnosis: caller injects a
// generate closure; core re-validates with Zod after the call.

import { getModel } from "../config";
import {
    IMPLICATION_BULLETS_SYSTEM_PROMPT,
    ImplicationBulletsSchema,
    buildImplicationBulletsPrompt,
    type ImplicationBullets,
    type ImplicationBulletsPromptInput,
} from "../prompts/implication-bullets";
import { err, ok, type AIError, type Result } from "../result";
import type { GenerateObjectFn } from "./narrative";

export interface ImplicationBulletsAdapterInput
    extends ImplicationBulletsPromptInput {
    readonly generate: GenerateObjectFn;
}

export async function generateImplicationBullets(
    input: ImplicationBulletsAdapterInput,
): Promise<Result<ImplicationBullets, AIError>> {
    const userPrompt = buildImplicationBulletsPrompt(input);
    let raw: unknown;
    try {
        const response = await input.generate({
            // reason: short JSON, latency-sensitive single-call prompt.
            model: getModel("narrative"),
            system: IMPLICATION_BULLETS_SYSTEM_PROMPT,
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
    const parsed = ImplicationBulletsSchema.safeParse(raw);
    if (!parsed.success) {
        return err({
            kind: "validation_failed",
            message: parsed.error.message,
            cause: parsed.error,
        });
    }
    return ok(parsed.data);
}
