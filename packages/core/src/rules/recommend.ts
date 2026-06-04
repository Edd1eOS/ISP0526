// Top-level recommend(): apply hard thresholds, score the survivors, keep the
// most suitable range by final_score, then sort those candidates into stretch /
// match / safety buckets capped at the spec's headcounts.
//
// Band assignment is per-candidate application risk. We do not force every
// report to have all three buckets; a "safety" label is worse than an empty
// safety bucket when the suitable pool contains only highly selective schools.

import {
    RecommendationSetSchema,
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
const TOTAL_LIMIT = LIMITS.stretch + LIMITS.match + LIMITS.safety;
const FIT_RANGE_MULTIPLIER = 2;
const FIT_SCORE_WINDOW = 18;

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

    const fitRange = selectFitRange(passing);

    const byBand = {
        stretch: fitRange.filter((s) => s.band === "stretch"),
        match: fitRange.filter((s) => s.band === "match"),
        safety: fitRange.filter((s) => s.band === "safety"),
    };

    const sortByFinalDesc = (a: Score, b: Score) => b.final_score - a.final_score;

    const set = RecommendationSetSchema.parse({
        stretch: byBand.stretch.sort(sortByFinalDesc).slice(0, LIMITS.stretch),
        match: byBand.match.sort(sortByFinalDesc).slice(0, LIMITS.match),
        safety: byBand.safety.sort(sortByFinalDesc).slice(0, LIMITS.safety),
    });

    return { set, excluded };
}

function selectFitRange(scored: readonly Score[]): Score[] {
    if (scored.length <= TOTAL_LIMIT) return [...scored];

    const sorted = [...scored].sort(
        (a, b) => b.final_score - a.final_score,
    );
    const top = sorted[0]?.final_score ?? 0;
    const floor = top - FIT_SCORE_WINDOW;
    const max = TOTAL_LIMIT * FIT_RANGE_MULTIPLIER;
    const selected = sorted.filter(
        (score, index) =>
            index < TOTAL_LIMIT ||
            (index < max && score.final_score >= floor),
    );

    return selected.length > 0 ? selected : sorted.slice(0, TOTAL_LIMIT);
}
