// Vercel AI SDK closure that backs core's GenerateObjectFn for the
// implication-bullets confirm card. Binds ImplicationBulletsSchema at
// call time; core re-validates afterwards for defense in depth.

import "server-only";
import { generateText, Output } from "ai";
import {
    ImplicationBulletsSchema,
    type GenerateObjectFn,
} from "@isp0526/core";
import { runTextWithFallback } from "./google-narrative";

export function buildGoogleImplicationBulletsGenerator(): GenerateObjectFn {
    return async ({ system, prompt }) => {
        const { output } = await runTextWithFallback((model) =>
            generateText({
                model,
                output: Output.object({ schema: ImplicationBulletsSchema }),
                system,
                prompt,
            }),
        );
        return { object: output };
    };
}
