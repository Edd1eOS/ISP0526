// Vercel AI SDK closure that backs core's GenerateObjectFn interface for
// the upload-summary prompt. Binds UploadDocumentSummarySchema at call
// time; core re-validates afterwards for defense in depth.

import "server-only";
import { generateText, Output } from "ai";
import {
    UploadDocumentSummarySchema,
    type GenerateObjectFn,
} from "@isp0526/core";
import { getTextModel } from "./google-narrative";

export function buildGoogleUploadSummaryGenerator(): GenerateObjectFn {
    return async ({ system, prompt }) => {
        const { output } = await generateText({
            model: getTextModel(),
            output: Output.object({ schema: UploadDocumentSummarySchema }),
            system,
            prompt,
        });
        return { object: output };
    };
}
