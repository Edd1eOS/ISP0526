// Vercel AI SDK closure that backs core's GenerateObjectFn interface for
// the voyage detail-refinement prompt. Binds VoyageTurnSchema at call
// time; core re-validates afterwards for defense in depth.

import "server-only";
import { generateText, Output } from "ai";
import { VoyageTurnSchema, type GenerateObjectFn } from "@isp0526/core";
import { runTextWithFallback } from "./google-narrative";

export function buildGoogleVoyageGenerator(): GenerateObjectFn {
    return async ({ system, prompt }) => {
        const { output } = await runTextWithFallback((model) =>
            generateText({
                model,
                output: Output.object({ schema: VoyageTurnSchema }),
                system,
                prompt,
            }),
        );
        return { object: output };
    };
}
