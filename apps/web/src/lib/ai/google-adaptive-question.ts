// Vercel AI SDK closure backing core's GenerateObjectFn for adaptive-question.

import "server-only";
import { generateText, Output } from "ai";
import { AdaptiveQuestionResultSchema, type GenerateObjectFn } from "@isp0526/core";
import { runTextWithFallback } from "./google-narrative";

export function buildGoogleAdaptiveQuestionGenerator(): GenerateObjectFn {
    return async ({ system, prompt }) => {
        const { output } = await runTextWithFallback((model) =>
            generateText({
                model,
                output: Output.object({ schema: AdaptiveQuestionResultSchema }),
                system,
                prompt,
            }),
        );
        return { object: output };
    };
}
