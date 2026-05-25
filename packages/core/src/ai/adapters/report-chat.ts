// Report chat adapter.
//
// Takes the student's follow-up question plus a flattened context derived
// from the report snapshot, calls the LLM, validates the response with
// Zod, then drops any citation whose source_id is not in the allowed set.

import { getModel } from "../config";
import { err, ok, type AIError, type Result } from "../result";
import {
    ReportChatReplySchema,
    SYSTEM_PROMPT,
    buildUserPrompt,
    type ReportChatPromptInput,
    type ReportChatReply,
} from "../prompts/report-chat";
import type { GenerateObjectFn } from "./narrative";

export interface ReportChatAdapterInput extends ReportChatPromptInput {
    readonly knownSourceIds: ReadonlySet<string>;
    readonly generate: GenerateObjectFn;
}

export async function generateReportChatReply(
    input: ReportChatAdapterInput,
): Promise<Result<ReportChatReply, AIError>> {
    const { generate, knownSourceIds, ...promptInput } = input;

    let raw: unknown;
    try {
        const response = await generate({
            model: getModel("narrative"),
            system: SYSTEM_PROMPT,
            prompt: buildUserPrompt(promptInput),
        });
        raw = response.object;
    } catch (cause) {
        return err({
            kind: "generation_failed",
            message: cause instanceof Error ? cause.message : "unknown error",
            cause,
        });
    }

    const parsed = ReportChatReplySchema.safeParse(raw);
    if (!parsed.success) {
        return err({
            kind: "validation_failed",
            message: parsed.error.message,
        });
    }

    const citations = parsed.data.citations.filter((c) =>
        knownSourceIds.has(c.source_id),
    );

    return ok({ ...parsed.data, citations });
}
