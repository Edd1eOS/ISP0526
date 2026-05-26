// Voyage detail-refinement adapter. Pattern mirrors upload-summary and
// intake-extraction: caller passes a generate closure that wraps the
// Vercel AI SDK (or a stub). Core re-validates the schema after the LLM
// returns for defense in depth.

import { getModel } from "../config";
import {
    VOYAGE_SYSTEM_PROMPT,
    VoyageTurnSchema,
    buildVoyageUserPrompt,
    type Locale,
    type VoyageAssessmentSummary,
    type VoyageHistoryTurn,
    type VoyageProfile,
    type VoyageTurn,
    type VoyageUploadContext,
} from "../prompts/voyage-question";
import { err, ok, type AIError, type Result } from "../result";
import type { GenerateObjectFn } from "./narrative";

export interface VoyageAdapterInput {
    readonly locale: Locale;
    readonly profile: VoyageProfile;
    readonly uploads: ReadonlyArray<VoyageUploadContext>;
    readonly assessment?: VoyageAssessmentSummary;
    readonly history: ReadonlyArray<VoyageHistoryTurn>;
    readonly maxTurns: number;
    readonly generate: GenerateObjectFn;
}

export async function nextVoyageTurn(
    input: VoyageAdapterInput,
): Promise<Result<VoyageTurn, AIError>> {
    const userPrompt = buildVoyageUserPrompt({
        locale: input.locale,
        profile: input.profile,
        uploads: input.uploads,
        ...(input.assessment ? { assessment: input.assessment } : {}),
        history: input.history,
        maxTurns: input.maxTurns,
    });

    let raw: unknown;
    try {
        const response = await input.generate({
            // reason: chat-style structured output, latency-sensitive — same
            // lane as intake-extraction.
            model: getModel("extraction"),
            system: VOYAGE_SYSTEM_PROMPT,
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

    const parsed = VoyageTurnSchema.safeParse(raw);
    if (!parsed.success) {
        return err({
            kind: "validation_failed",
            message: parsed.error.message,
        });
    }

    // Defense in depth: if done=false, the model must include a question.
    // When the model forgets (some providers occasionally omit the field
    // even though done=false), synthesize a neutral open-ended question
    // in the user's locale so the voyage can keep going instead of
    // dead-ending the user.
    if (!parsed.data.done && !parsed.data.question) {
        const isZh = input.locale === "zh";
        parsed.data.question = {
            topic: isZh ? "下一步" : "next_step",
            prompt: isZh
                ? "可以再多说一点你最在意的方向吗？比如预算、地点、专业方向，或校园生活的某个细节。"
                : "Could you share a bit more about what matters most to you next — anything about budget, location, program focus, or campus life?",
            kind: "free",
            placeholder: isZh ? "写几句话" : "Type a few sentences",
        };
    }

    return ok(parsed.data);
}
