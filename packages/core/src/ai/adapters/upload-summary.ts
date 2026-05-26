// Upload-summary adapter. Mirrors the intake-extraction adapter pattern:
// the caller passes a `generate` closure that wraps the Vercel AI SDK (or
// a stub in tests). The adapter Zod-validates the model output before
// returning so downstream UI can trust the shape.

import { getModel } from "../config";
import {
    UPLOAD_SUMMARY_SYSTEM_PROMPT,
    UploadDocumentSummarySchema,
    buildUploadSummaryUserPrompt,
    type Locale,
    type UploadDocumentSummary,
} from "../prompts/upload-summary";
import { err, ok, type AIError, type Result } from "../result";
import type { GenerateObjectFn } from "./narrative";

export interface UploadSummaryAdapterInput {
    readonly locale: Locale;
    readonly fileName: string;
    readonly text: string;
    readonly generate: GenerateObjectFn;
}

export async function summarizeUploadDocument(
    input: UploadSummaryAdapterInput,
): Promise<Result<UploadDocumentSummary, AIError>> {
    const { locale, fileName, text, generate } = input;

    if (text.trim().length === 0) {
        return err({
            kind: "validation_failed",
            message: "source text is empty",
        });
    }

    const userPrompt = buildUploadSummaryUserPrompt({ locale, fileName, text });

    let raw: unknown;
    try {
        const response = await generate({
            // reason: extraction-class call - same latency/cost budget as
            // intake-extraction, so we reuse that model lane.
            model: getModel("extraction"),
            system: UPLOAD_SUMMARY_SYSTEM_PROMPT,
            prompt: userPrompt,
        });
        raw = response.object;
    } catch (cause) {
        return err({
            kind: "generation_failed",
            message: cause instanceof Error ? cause.message : "unknown error",
            cause,
        });
    }

    const parsed = UploadDocumentSummarySchema.safeParse(raw);
    if (!parsed.success) {
        return err({
            kind: "validation_failed",
            message: parsed.error.message,
        });
    }

    // Strip applicant_summary if the model contradicted itself by setting
    // about_applicant=false but still returning a summary. Defense in depth
    // for the UI rendering logic.
    if (!parsed.data.about_applicant && parsed.data.applicant_summary) {
        return ok({ ...parsed.data, applicant_summary: undefined });
    }

    return ok(parsed.data);
}
