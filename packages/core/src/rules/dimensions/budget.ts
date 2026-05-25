// Budget fit dimension.
//
// Phase 1 compares annual tuition against the student's annual all-in budget
// (after `flex` headroom). Living cost is not yet in the dataset; this scoring
// function intentionally errs toward "no signal" when budget is missing rather
// than penalizing candidates.
//
// TODO: when `University.living_cost_aud_annual` exists, fold it in here.

import type { Candidate, StudentProfile } from "../../schemas/index";
import { SCORING_WEIGHTS } from "../weights";

export const defaultWeight = SCORING_WEIGHTS.budget;

const NEUTRAL = 0.5;

export function score(profile: StudentProfile, candidate: Candidate): number {
    const { budget } = profile;
    const { tuition } = candidate.program;

    if (budget.annual_aud === undefined) return NEUTRAL;

    const effectiveBudget = budget.annual_aud * (1 + budget.flex);
    if (tuition.annual <= effectiveBudget) {
        // Headroom rewards budget comfort up to a 50% margin.
        const headroom = (effectiveBudget - tuition.annual) / effectiveBudget;
        return clamp01(0.7 + headroom * 0.6);
    }
    const overshoot = (tuition.annual - effectiveBudget) / effectiveBudget;
    if (overshoot >= 0.5) return 0;
    return clamp01(0.7 - overshoot * 1.4);
}

export function explain(
    profile: StudentProfile,
    candidate: Candidate,
): string[] {
    const { budget } = profile;
    const { tuition } = candidate.program;

    if (budget.annual_aud === undefined) {
        return ["未提供年预算，预算匹配采用中性估值。"];
    }
    const effective = Math.round(budget.annual_aud * (1 + budget.flex));
    if (tuition.annual <= effective) {
        return [
            `学费 AUD ${tuition.annual.toLocaleString()} 在你的年预算 AUD ${effective.toLocaleString()} 内（含 ${Math.round(budget.flex * 100)}% 弹性）。`,
        ];
    }
    return [
        `学费 AUD ${tuition.annual.toLocaleString()} 超出你的年预算 AUD ${effective.toLocaleString()}（含弹性）。`,
    ];
}

function clamp01(n: number): number {
    return n < 0 ? 0 : n > 1 ? 1 : n;
}
