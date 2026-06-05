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
import { safetyEligible } from "./bands";

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

export type RecommendCoverage = {
    /** Programs that passed hard thresholds before any capping. */
    passing: number;
    /** Programs that survived the country cap. */
    after_country_cap: number;
    /** Programs that survived the fit-score window. */
    after_fit_range: number;
    /** Final per-band counts after redistribution and slicing. */
    per_band: { stretch: number; match: number; safety: number };
    /** True when downstream UI should warn the user that the candidate pool is
     *  thin enough that confidence in the displayed set is limited. */
    sparse: boolean;
    /** Human-readable reasons explaining why coverage is sparse, if any.
     *  These are diagnostic strings (English) for engineering / debug surfaces,
     *  not user-facing copy; the UI layer should translate via i18n. */
    reasons: string[];
};

export type RecommendOutput = {
    set: RecommendationSet;
    excluded: ExcludedCandidate[];
    coverage: RecommendCoverage;
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
    const rebalanced = fillEmptyBands(fitRange, profile, candidateIndex);

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

    const coverage = buildCoverage({
        passing: passing.length,
        afterCountryCap: capped.length,
        afterFitRange: fitRange.length,
        set,
    });

    return { set, excluded, coverage };
}

const SPARSE_TOTAL_THRESHOLD = 4;
const SPARSE_PER_BAND_THRESHOLD = 1;

function buildCoverage(input: {
    readonly passing: number;
    readonly afterCountryCap: number;
    readonly afterFitRange: number;
    readonly set: RecommendationSet;
}): RecommendCoverage {
    const perBand = {
        stretch: input.set.stretch.length,
        match: input.set.match.length,
        safety: input.set.safety.length,
    };
    const total = perBand.stretch + perBand.match + perBand.safety;

    const reasons: string[] = [];
    if (input.passing === 0) {
        reasons.push("no candidates passed hard thresholds");
    } else {
        if (input.passing < SPARSE_TOTAL_THRESHOLD) {
            reasons.push(
                `only ${input.passing} programs passed hard thresholds`,
            );
        }
        if (input.afterCountryCap < input.passing) {
            const dropped = input.passing - input.afterCountryCap;
            if (input.afterCountryCap < SPARSE_TOTAL_THRESHOLD) {
                reasons.push(
                    `country cap removed ${dropped} programs; ${input.afterCountryCap} remain`,
                );
            }
        }
        for (const band of ["stretch", "match", "safety"] as const) {
            if (perBand[band] <= SPARSE_PER_BAND_THRESHOLD) {
                reasons.push(`${band} bucket has ${perBand[band]} entries`);
            }
        }
        if (total < SPARSE_TOTAL_THRESHOLD) {
            reasons.push(`final recommendation set has ${total} entries`);
        }
    }

    return {
        passing: input.passing,
        after_country_cap: input.afterCountryCap,
        after_fit_range: input.afterFitRange,
        per_band: perBand,
        sparse: reasons.length > 0,
        reasons,
    };
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
//
// Guardrail: a candidate that was originally classified "stretch" cannot be
// downgraded to "safety" here, and any candidate that fails safetyEligible()
// is capped at "match". This prevents the redistribution step from
// reintroducing the very "selective program shown as safety" bug that
// classifyApplicationBand() guards against.
function fillEmptyBands(
    scored: readonly Score[],
    profile: StudentProfile,
    candidateIndex: ReadonlyMap<string, Candidate>,
): Score[] {
    if (scored.length < 3) return [...scored];

    const present = new Set(scored.map((s) => s.band));
    if (
        present.has("stretch") &&
        present.has("match") &&
        present.has("safety")
    ) {
        return [...scored];
    }

    const originalBand = new Map(scored.map((s) => [s.program_id, s.band] as const));

    const sorted = [...scored].sort(
        (a, b) => a.breakdown.academic_fit - b.breakdown.academic_fit,
    );
    const n = sorted.length;
    // Smallest tertile floors at 1 so every band gets at least one entry.
    const stretchSize = Math.max(1, Math.floor(n / 3));
    const safetySize = Math.max(1, Math.floor(n / 3));
    return sorted.map((s, i): Score => {
        let band: BandTier =
            i < stretchSize
                ? "stretch"
                : i >= n - safetySize
                    ? "safety"
                    : "match";
        if (band === "safety") {
            const candidate = candidateIndex.get(s.program_id);
            const wasStretch = originalBand.get(s.program_id) === "stretch";
            if (wasStretch || (candidate && !safetyEligible(profile, candidate))) {
                band = "match";
            }
        }
        return { ...s, band };
    });
}
