// Wish-parse adapter. Mirrors the implication-bullets pattern:
// caller injects a generate closure; core re-validates with Zod.

import { getModel } from "../config";
import {
    WISH_PARSE_SYSTEM_PROMPT,
    WishParseResultSchema,
    buildWishParsePrompt,
    type WishParseResult,
    type WishParsePromptInput,
} from "../prompts/wish-parse";
import { err, ok, type AIError, type Result } from "../result";
import type { GenerateObjectFn } from "./narrative";

export interface WishParseAdapterInput extends WishParsePromptInput {
    readonly generate: GenerateObjectFn;
}

export async function parseWish(
    input: WishParseAdapterInput,
): Promise<Result<WishParseResult, AIError>> {
    const userPrompt = buildWishParsePrompt(input);
    let raw: unknown;
    try {
        const response = await input.generate({
            // Latency-sensitive inline call; use the faster narrative model.
            model: getModel("narrative"),
            system: WISH_PARSE_SYSTEM_PROMPT,
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
    const parsed = WishParseResultSchema.safeParse(raw);
    if (!parsed.success) {
        return err({
            kind: "validation_failed",
            message: parsed.error.message,
            cause: parsed.error,
        });
    }
    return ok(parsed.data);
}
