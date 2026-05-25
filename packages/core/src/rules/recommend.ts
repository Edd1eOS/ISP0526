// Top-level recommend(): apply hard thresholds, score the survivors, sort
// into stretch / match / safety buckets capped at the spec's headcounts, and
// return a validated RecommendationSet.
//
// Band assignment is hybrid:
//   1. classifyBand() gives each candidate its absolute band from academic_fit.
//   2. If the pool has >= 3 survivors but a band came up empty, we
//      redistribute by academic_fit rank so every band has at least one
//      entry. This is the only place that touches band assignment globally;
//      per-candidate band remains driven by classifyBand().

import {
    RecommendationSetSchema,
    type BandTier,
    type Candidate,
    type RecommendationSet,
    type Score,
    type StudentProfile,
} from "../schemas/index";
import { applyHardThresholds, type ExclusionReason } from "./thresholds";
import { scoreCandidate } from "./score";

const LIMITS = {
    stretch: 4,
    match: 4,
    safety: 4,
} as const;

export type ExcludedCandidate = {
    program_id: string;
    university_id: string;
    reason: ExclusionReason;
};

export type RecommendOutput = {
    set: RecommendationSet;
    excluded: ExcludedCandidate[];
};

export function recommend(
    profile: StudentProfile,
    candidates: readonly Candidate[],
): RecommendOutput {
    const passing: Score[] = [];
    const excluded: ExcludedCandidate[] = [];

    for (const candidate of candidates) {
        const threshold = applyHardThresholds(profile, candidate);
        if (threshold.kind === "exclude") {
            excluded.push({
                program_id: candidate.program.id,
                university_id: candidate.university.id,
                reason: threshold.reason,
            });
            continue;
        }
        passing.push(scoreCandidate(profile, candidate));
    }

    const rebalanced = fillEmptyBands(passing);

    const byBand = {
        stretch: rebalanced.filter((s) => s.band === "stretch"),
        match: rebalanced.filter((s) => s.band === "match"),
        safety: rebalanced.filter((s) => s.band === "safety"),
    };

    const sortByFinalDesc = (a: Score, b: Score) => b.final_score - a.final_score;

    const set = RecommendationSetSchema.parse({
        stretch: byBand.stretch.sort(sortByFinalDesc).slice(0, LIMITS.stretch),
        match: byBand.match.sort(sortByFinalDesc).slice(0, LIMITS.match),
        safety: byBand.safety.sort(sortByFinalDesc).slice(0, LIMITS.safety),
    });

    return { set, excluded };
}

// Rank-based redistribution. If the absolute thresholds left a band empty
// while >= 3 candidates passed, split the pool into three roughly equal
// slices by academic_fit ascending. Lowest fit -> stretch (hardest reach),
// highest fit -> safety. The returned scores carry the new band but their
// `breakdown` and `final_score` are unchanged.
function fillEmptyBands(scored: readonly Score[]): Score[] {
    if (scored.length < 3) return [...scored];

    const present = new Set(scored.map((s) => s.band));
    if (
        present.has("stretch") &&
        present.has("match") &&
        present.has("safety")
    ) {
        return [...scored];
    }

    const sorted = [...scored].sort(
        (a, b) => a.breakdown.academic_fit - b.breakdown.academic_fit,
    );
    const n = sorted.length;
    // Smallest tertile floors at 1 so every band gets at least one entry.
    const stretchSize = Math.max(1, Math.floor(n / 3));
    const safetySize = Math.max(1, Math.floor(n / 3));
    return sorted.map((s, i): Score => {
        const band: BandTier =
            i < stretchSize
                ? "stretch"
                : i >= n - safetySize
                    ? "safety"
                    : "match";
        return { ...s, band };
    });
}
