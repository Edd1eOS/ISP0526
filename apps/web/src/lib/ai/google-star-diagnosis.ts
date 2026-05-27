// Vercel AI SDK closure that backs core's GenerateObjectFn for the
// star-chart end-flow diagnosis prompt. Binds StarDiagnosisSchema at
// call time; core re-validates afterwards for defense in depth.

import "server-only";
import { generateText, Output } from "ai";
import { StarDiagnosisSchema, type GenerateObjectFn } from "@isp0526/core";
import { runTextWithFallback } from "./google-narrative";

export function buildGoogleStarDiagnosisGenerator(): GenerateObjectFn {
    return async ({ system, prompt }) => {
        const { output } = await runTextWithFallback((model) =>
            generateText({
                model,
                output: Output.object({ schema: StarDiagnosisSchema }),
                system,
                prompt,
            }),
        );
        return { object: output };
    };
}
