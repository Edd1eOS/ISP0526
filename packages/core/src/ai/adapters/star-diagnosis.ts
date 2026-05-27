// Star-chart diagnosis adapter. Mirrors voyage-question / upload-summary:
// caller injects a generate closure; core re-validates with Zod after the
// call.

import { getModel } from "../config";
import {
    STAR_DIAGNOSIS_SYSTEM_PROMPT,
    StarDiagnosisSchema,
    buildStarDiagnosisPrompt,
    type StarDiagnosis,
    type StarDiagnosisPromptInput,
} from "../prompts/star-diagnosis";
import { err, ok, type AIError, type Result } from "../result";
import type { GenerateObjectFn } from "./narrative";

export interface StarDiagnosisAdapterInput
    extends StarDiagnosisPromptInput {
    readonly generate: GenerateObjectFn;
}

export async function generateStarDiagnosis(
    input: StarDiagnosisAdapterInput,
): Promise<Result<StarDiagnosis, AIError>> {
    const userPrompt = buildStarDiagnosisPrompt(input);

    let raw: unknown;
    try {
        const response = await input.generate({
            // reason: narrative-style short JSON, latency-sensitive single call.
            model: getModel("narrative"),
            system: STAR_DIAGNOSIS_SYSTEM_PROMPT,
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

    const parsed = StarDiagnosisSchema.safeParse(raw);
    if (!parsed.success) {
        return err({
            kind: "validation_failed",
            message: parsed.error.message,
            cause: parsed.error,
        });
    }
    return ok(parsed.data);
}
