// Vercel AI SDK closure that backs core's GenerateObjectFn interface using
// Google's Gemini provider. Kept in the web app rather than core so that
// core stays SDK-agnostic and can be reused under non-Vercel runtimes.

import "server-only";
import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import {
    BatchNarrativeSchema,
    type GenerateObjectFn,
} from "@isp0526/core";

const PRIMARY_MODEL_ID = "gemini-2.0-flash";

export function isGoogleConfigured(): boolean {
    return Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY);
}

// Returns a generate function bound to the batch schema. We bind the schema
// here rather than in the core adapter because Vercel AI SDK's
// generateObject requires the schema at call time (it shapes the model's
// JSON output via tool calling). The core adapter re-validates with Zod
// after the call so this stays defense-in-depth.
export function buildGoogleBatchGenerator(): GenerateObjectFn {
    return async ({ system, prompt }) => {
        const { object } = await generateObject({
            model: google(PRIMARY_MODEL_ID),
            schema: BatchNarrativeSchema,
            system,
            prompt,
        });
        return { object };
    };
}
