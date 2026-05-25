// Vercel AI SDK closure that backs core's GenerateObjectFn interface for
// the report follow-up chat. Bound to ReportChatReplySchema at call time
// because generateObject shapes the model's JSON output via tool calling.
// Core re-validates with Zod after the call as defense-in-depth.

import "server-only";
import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import {
    ReportChatReplySchema,
    type GenerateObjectFn,
} from "@isp0526/core";

const PRIMARY_MODEL_ID = process.env.GOOGLE_TEXT_MODEL_ID ?? "gemini-2.5-flash";

export function buildGoogleReportChatGenerator(): GenerateObjectFn {
    return async ({ system, prompt }) => {
        const { object } = await generateObject({
            model: google(PRIMARY_MODEL_ID),
            schema: ReportChatReplySchema,
            system,
            prompt,
        });
        return { object };
    };
}
