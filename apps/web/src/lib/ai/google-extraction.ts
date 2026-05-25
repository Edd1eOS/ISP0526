// Vercel AI SDK closure that backs core's GenerateObjectFn interface for
// the intake extraction prompt. Binds the ExtractedProfileSchema at call
// time as Vercel's Output.object requires; core re-validates with Zod
// afterwards for defense in depth.

import "server-only";
import { generateText, Output } from "ai";
import {
    ExtractedProfileSchema,
    type GenerateObjectFn,
} from "@isp0526/core";
import { getTextModel } from "./google-narrative";

export function buildGoogleExtractionGenerator(): GenerateObjectFn {
    return async ({ system, prompt }) => {
        const { output } = await generateText({
            model: getTextModel(),
            output: Output.object({ schema: ExtractedProfileSchema }),
            system,
            prompt,
        });
        return { object: output };
    };
}
