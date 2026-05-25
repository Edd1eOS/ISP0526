// Vercel AI SDK closure that backs core's GenerateObjectFn interface for
// the report follow-up chat. Bound to ReportChatReplySchema at call time
// because generateObject shapes the model's JSON output via tool calling.
// Core re-validates with Zod after the call as defense-in-depth.

import "server-only";
import { generateText, Output } from "ai";
import {
    ReportChatReplySchema,
    type GenerateObjectFn,
} from "@isp0526/core";
import { getTextModel } from "./google-narrative";

export function buildGoogleReportChatGenerator(): GenerateObjectFn {
    return async ({ system, prompt }) => {
        const { output } = await generateText({
            model: getTextModel(),
            output: Output.object({ schema: ReportChatReplySchema }),
            system,
            prompt,
        });
        return { object: output };
    };
}
