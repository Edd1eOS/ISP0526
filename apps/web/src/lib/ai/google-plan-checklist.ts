// Vercel AI SDK closure that backs core's GenerateObjectFn interface for
// the plan checklist generator. Core re-validates the result with Zod.

import "server-only";
import { generateText, Output } from "ai";
import {
    PlanChecklistSchema,
    type GenerateObjectFn,
} from "@isp0526/core";
import { getTextModel } from "./google-narrative";

export function buildGooglePlanChecklistGenerator(): GenerateObjectFn {
    return async ({ system, prompt }) => {
        const { output } = await generateText({
            model: getTextModel(),
            output: Output.object({ schema: PlanChecklistSchema }),
            system,
            prompt,
        });
        return { object: output };
    };
}
