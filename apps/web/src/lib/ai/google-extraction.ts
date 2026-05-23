// Vercel AI SDK closure that backs core's GenerateObjectFn interface for
// the intake extraction prompt. Binds the ExtractedProfileSchema at call
// time as Vercel's generateObject requires; core re-validates with Zod
// afterwards for defense in depth.

import "server-only";
import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import {
    ExtractedProfileSchema,
    type GenerateObjectFn,
} from "@isp0526/core";

const PRIMARY_MODEL_ID = "gemini-2.0-flash";

export function buildGoogleExtractionGenerator(): GenerateObjectFn {
    return async ({ system, prompt }) => {
        const { object } = await generateObject({
            model: google(PRIMARY_MODEL_ID),
            schema: ExtractedProfileSchema,
            system,
            prompt,
        });
        return { object };
    };
}
