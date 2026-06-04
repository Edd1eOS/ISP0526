// Top-level recommend(): apply hard thresholds, score the survivors, keep the
// most suitable range by final_score, then sort those candidates into stretch /
// match / safety buckets capped at the spec's headcounts.
//
// Band assignment is per-candidate application risk. We do not force every
// report to have all three buckets; a "safety" label is worse than an empty
// safety bucket when the suitable pool contains only highly selective schools.

import {
    RecommendationSetSchema,
    type BandTier,
    type Candidate,
    type Country,
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

// Maximum countries in the final set for each scenario:
//   - user stated a preference → their countries + this many extras
//   - user expressed no preference → pick this many top countries
const MAX_EXTRA_WITH_PREF = 1;
const MAX_COUNTRIES_NO_PREF = 3;

/**
 * Post-scoring country cap. Limits unique destination countries in the
 * recommendation output so results stay focused.
 *
 * - Preference set non-empty: keep all preferred countries + 1 best-scoring
 *   extra country (bridges gaps when the preferred pool is shallow).
 * - No preference: keep programs from the top-3 countries by aggregate score.
 */
function capByCountry(
    scores: readonly Score[],
    preferredCountries: readonly Country[],
    candidateIndex: ReadonlyMap<string, Candidate>,
): Score[] {
    const country = (s: Score) =>
        candidateIndex.get(s.program_id)?.university.country ?? "";

    const tally = (subset: readonly Score[]) => {
        const m = new Map<string, number>();
        for (const s of subset) {
            const c = country(s);
            m.set(c, (m.get(c) ?? 0) + s.final_score);
        }
        return m;
    };

    if (preferredCountries.length === 0) {
        // No preference: top-N countries by aggregate score.
        const totals = tally(scores);
        const allowed = new Set(
            [...totals.entries()]
                .sort((a, b) => b[1] - a[1])
                .slice(0, MAX_COUNTRIES_NO_PREF)
                .map(([c]) => c),
        );
        return scores.filter((s) => allowed.has(country(s)));
    }

    // Has preference: preferred + up to MAX_EXTRA extras.
    const prefSet = new Set<string>(preferredCountries);
    const extraTotals = tally(scores.filter((s) => !prefSet.has(country(s))));
    const bestExtras = new Set(
        [...extraTotals.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, MAX_EXTRA_WITH_PREF)
            .map(([c]) => c),
    );
    return scores.filter(
        (s) => prefSet.has(country(s)) || bestExtras.has(country(s)),
    );
}

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

    // Build index once — used by capByCountry and for narrative generation.
    const candidateIndex = new Map(
        candidates.map((c) => [c.program.id, c] as const),
    );

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

    // 1. Country cap first so downstream stages only see allowed countries.
    const capped = capByCountry(
        passing,
        profile.hard_constraints.preferred_countries,
        candidateIndex,
    );

    // 2. Keep the suitable fit-score window.
    const fitRange = selectFitRange(capped);

    // 3. Redistribute bands by academic_fit when any slot is empty.
    const rebalanced = fillEmptyBands(fitRange);

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
