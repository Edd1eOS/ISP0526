// Plan checklist adapter.
//
// Calls the LLM with the student's six final picks and returns a validated
// PlanChecklist. Items are not source-filtered (the prompt requires the LLM
// to mark uncertain items as `tentative` rather than emit citations), but
// we still validate every field with Zod.

import { getModel } from "../config";
import { err, ok, type AIError, type Result } from "../result";
import {
    PlanChecklistSchema,
    SYSTEM_PROMPT,
    buildUserPrompt,
    type PlanChecklist,
    type PlanChecklistPromptInput,
} from "../prompts/plan-checklist";
import type { GenerateObjectFn } from "./narrative";

export interface PlanChecklistAdapterInput extends PlanChecklistPromptInput {
    readonly generate: GenerateObjectFn;
}

export async function generatePlanChecklist(
    input: PlanChecklistAdapterInput,
): Promise<Result<PlanChecklist, AIError>> {
    const { generate, ...promptInput } = input;

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

    const parsed = PlanChecklistSchema.safeParse(raw);
    if (!parsed.success) {
        return err({
            kind: "validation_failed",
            message: parsed.error.message,
        });
    }

    return ok(parsed.data);
}
