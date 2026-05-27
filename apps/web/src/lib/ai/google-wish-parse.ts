// Vercel AI SDK closure backing core's GenerateObjectFn for wish-parse.

import "server-only";
import { generateText, Output } from "ai";
import { WishParseResultSchema, type GenerateObjectFn } from "@isp0526/core";
import { runTextWithFallback } from "./google-narrative";

export function buildGoogleWishParseGenerator(): GenerateObjectFn {
    return async ({ system, prompt }) => {
        const { output } = await runTextWithFallback((model) =>
            generateText({
                model,
                output: Output.object({ schema: WishParseResultSchema }),
                system,
                prompt,
            }),
        );
        return { object: output };
    };
}
