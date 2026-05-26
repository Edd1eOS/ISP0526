// Server action for the voyage detail-refinement step. Wraps the core
// adapter so the React client can call it directly. The non-async
// projection helper that maps VoyageProfile -> ClarifyPatch lives in
// voyage-projection.ts (Next.js forbids non-async exports from
// "use server" files).

"use server";

import {
    nextVoyageTurn,
    type VoyageAssessmentSummary,
    type VoyageHistoryTurn,
    type VoyageProfile,
    type VoyageTurn,
    type VoyageUploadContext,
} from "@isp0526/core";

import {
    buildGoogleVoyageGenerator,
} from "../../lib/ai/google-voyage";
import { isLLMConfigured } from "../../lib/ai/google-narrative";

// Soft ceiling only — used as a runaway guard so a malfunctioning LLM
// cannot loop forever. The real stop condition is dimension-coverage
// based completeness >= 0.9, as documented in docs/voyage-profile-spec.md.
const VOYAGE_TURN_RUNAWAY_GUARD = 60;

export interface VoyageTurnActionInput {
    readonly profile: VoyageProfile;
    readonly history: ReadonlyArray<VoyageHistoryTurn>;
    readonly uploads: ReadonlyArray<VoyageUploadContext>;
    readonly assessment?: VoyageAssessmentSummary;
    readonly locale: "zh" | "en";
}

export interface VoyageTurnActionResult {
    readonly ok: boolean;
    readonly turn?: VoyageTurn;
    readonly error?: string;
    readonly degraded?: boolean;
}

export async function nextVoyageTurnAction(
    input: VoyageTurnActionInput,
): Promise<VoyageTurnActionResult> {
    if (!isLLMConfigured()) {
        return {
            ok: false,
            degraded: true,
            error: "LLM not configured",
        };
    }

    const result = await nextVoyageTurn({
        locale: input.locale,
        profile: input.profile,
        uploads: input.uploads,
        assessment: input.assessment,
        history: input.history,
        maxTurns: VOYAGE_TURN_RUNAWAY_GUARD,
        generate: buildGoogleVoyageGenerator(),
    });

    if (!result.ok) {
        return {
            ok: false,
            error: result.error.message,
        };
    }

    return { ok: true, turn: result.value };
}
