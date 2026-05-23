/**
 * Scoring weights for the rule-based recommendation engine.
 * Source: docs/spec.md section 5.5.
 *
 * Sum must equal 1.0. Modifications require updating spec.md AND
 * appending an entry to docs/change_record.md.
 *
 * No I/O, no LLM calls. Pure constants.
 */

export const SCORING_WEIGHTS = {
    academic_fit: 0.3,
    personality: 0.15,
    lifestyle: 0.15,
    career: 0.15,
    budget: 0.1,
    tag_boost: 0.1,
    reputation: 0.05,
} as const;

export type ScoringDimension = keyof typeof SCORING_WEIGHTS;

export const BAND_THRESHOLDS = {
    stretch_max: 0.55,
    match_max: 0.8,
    // safety: > match_max
} as const;
