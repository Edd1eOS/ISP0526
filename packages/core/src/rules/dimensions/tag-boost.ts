// Tag-boost dimension.
//
// Increases score for programs that carry tags the student opted into during
// the preference step. Each preferred tag contributes equally; capped at 1.0.

import type { Candidate, StudentProfile } from "../../schemas/index.js";
import { SCORING_WEIGHTS } from "../weights.js";

export const defaultWeight = SCORING_WEIGHTS.tag_boost;

const NEUTRAL = 0.5;

export function score(profile: StudentProfile, candidate: Candidate): number {
    const preferred = profile.preferred_tags;
    if (preferred.length === 0) return NEUTRAL;
    const have = new Set(candidate.program.tags);
    const hits = preferred.filter((t) => have.has(t)).length;
    return clamp01(hits / preferred.length);
}

export function explain(
    profile: StudentProfile,
    candidate: Candidate,
): string[] {
    const preferred = profile.preferred_tags;
    if (preferred.length === 0) {
        return ["No preferred tags selected; tag boost defaulted to neutral."];
    }
    const have = new Set(candidate.program.tags);
    const hits = preferred.filter((t) => have.has(t));
    const misses = preferred.filter((t) => !have.has(t));
    const reasons: string[] = [];
    if (hits.length > 0) {
        reasons.push(`Program matches preferred tags: ${hits.join(", ")}.`);
    }
    if (misses.length > 0) {
        reasons.push(`Preferred tags not present on this program: ${misses.join(", ")}.`);
    }
    return reasons;
}

function clamp01(n: number): number {
    return n < 0 ? 0 : n > 1 ? 1 : n;
}
