// Map a candidate's application risk to one of three display bands.
//
// The thresholds reflect intent, not statistics:
//   stretch: high admission difficulty relative to the student's file
//   match:   plausible admission difficulty with some headroom
//   safety:  lower admission difficulty and strong academic headroom
//
// We intentionally keep admission difficulty distinct from "fit". A program
// can be a very good fit and still be a stretch if the institution/program is
// highly selective.

import type { BandTier, Candidate, SelectivityTier, StudentProfile } from "../schemas/index";
import { BAND_THRESHOLDS } from "./weights";

const ELITE_REPUTATION = 0.96;
const ELITE_DIFFICULTY_FLOOR = 0.88;
const SAFETY_DIFFICULTY_CEILING = 0.74;
// Difficulty above this is treated as "selective" for safety-eligibility
// purposes. Selective programs cannot be labeled safety without full evidence
// (GPA + language when required).
const SELECTIVE_DIFFICULTY_FLOOR = 0.78;

// Anchor difficulties for each selectivity tier. When a program carries an
// explicit admission_profile.selectivity we use this anchor directly instead
// of the reputation/gpa_min proxy, since admit-rate-driven tiers are the more
// trustworthy selectivity signal.
const SELECTIVITY_ANCHOR: Record<SelectivityTier, number> = {
    open: 0.4,
    standard: 0.6,
    selective: 0.8,
    highly_selective: 0.9,
    elite: 0.97,
};

export function classifyBand(academicFit: number): BandTier {
    if (academicFit < BAND_THRESHOLDS.stretch_max) return "stretch";
    if (academicFit < BAND_THRESHOLDS.match_max) return "match";
    return "safety";
}

export function classifyApplicationBand(
    profile: StudentProfile,
    candidate: Candidate,
    academicFit: number,
): BandTier {
    const difficulty = estimateAdmissionDifficulty(candidate);

    // MIT/Stanford/Imperial/UCL/NUS-style rows in this dataset should never
    // be displayed as "safety" from GPA headroom alone. Without admit-rate
    // data, elite reputation + field_top is the best available selectivity
    // proxy.
    if (difficulty >= ELITE_DIFFICULTY_FLOOR) return "stretch";

    const risk = difficulty - academicHeadroomCredit(profile, academicFit);
    if (risk >= BAND_THRESHOLDS.match_max) return "stretch";
    if (risk >= BAND_THRESHOLDS.stretch_max) return "match";
    if (difficulty >= SAFETY_DIFFICULTY_CEILING) return "match";
    // Do not claim "safety" on a selective program when the evidence is
    // incomplete (missing GPA or missing required-language score).
    if (!safetyEligible(profile, candidate)) return "match";
    return "safety";
}

/**
 * Whether a candidate may carry the "safety" label given the available
 * student evidence. Returns true for non-selective programs unconditionally;
 * for selective programs requires GPA evidence and, when the program lists a
 * language requirement, a corresponding student score.
 *
 * Pure: no I/O. Used by both classifyApplicationBand() (per-candidate) and
 * fillEmptyBands() (post-redistribution guard).
 */
export function safetyEligible(
    profile: StudentProfile,
    candidate: Candidate,
): boolean {
    const difficulty = estimateAdmissionDifficulty(candidate);
    if (difficulty < SELECTIVE_DIFFICULTY_FLOOR) return true;

    const hasGpa =
        profile.academic.gpa !== undefined ||
        profile.academic.credentials.length > 0;
    if (!hasGpa) return false;

    const langRequired =
        candidate.program.language_min.ielts_overall !== undefined ||
        candidate.program.language_min.toefl_total !== undefined;
    if (langRequired) {
        const hasLang =
            profile.academic.ielts_overall !== undefined ||
            profile.academic.toefl_total !== undefined;
        if (!hasLang) return false;
    }
    return true;
}

export function estimateAdmissionDifficulty(candidate: Candidate): number {
    // Explicit selectivity tier wins over proxy-based estimation.
    const tier = candidate.program.admission_profile?.selectivity;
    if (tier !== undefined) {
        const anchor = SELECTIVITY_ANCHOR[tier];
        // Small boost from field_top / phd so multiple programs at the same
        // tier still sort sensibly, but the boost cannot move a program out
        // of its declared tier band.
        const fieldTopBonus = candidate.program.tags.includes("field_top") ? 0.01 : 0;
        const phdBonus = candidate.program.level === "phd" ? 0.01 : 0;
        return clamp01(anchor + fieldTopBonus + phdBonus);
    }

    const reputation = candidate.university.reputation_score;
    const gpaFloor =
        candidate.program.gpa_min !== undefined
            ? candidate.program.gpa_min / 4
            : 0.5;
    const fieldTopBonus = candidate.program.tags.includes("field_top") ? 0.04 : 0;
    const phdBonus = candidate.program.level === "phd" ? 0.04 : 0;
    const eliteBonus = reputation >= ELITE_REPUTATION ? 0.05 : 0;

    return clamp01(
        reputation * 0.55 +
        gpaFloor * 0.35 +
        fieldTopBonus +
        phdBonus +
        eliteBonus,
    );
}

function academicHeadroomCredit(
    profile: StudentProfile,
    academicFit: number,
): number {
    const hasAcademicSignal =
        profile.academic.gpa !== undefined ||
        profile.academic.credentials.length > 0 ||
        profile.academic.ielts_overall !== undefined ||
        profile.academic.toefl_total !== undefined;
    if (!hasAcademicSignal) return 0;

    // academicFit is already 0..1. Convert only above-neutral headroom into a
    // modest risk reduction so strong grades can move a normal program from
    // match to safety, but cannot make elite programs "safe".
    return Math.max(0, academicFit - 0.5) * 0.3;
}

function clamp01(n: number): number {
    if (n < 0) return 0;
    if (n > 1) return 1;
    return n;
}
