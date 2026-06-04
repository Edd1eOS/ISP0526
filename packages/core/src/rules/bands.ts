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

import type { BandTier, Candidate, StudentProfile } from "../schemas/index";
import { BAND_THRESHOLDS } from "./weights";

const ELITE_REPUTATION = 0.96;
const ELITE_DIFFICULTY_FLOOR = 0.88;
const SAFETY_DIFFICULTY_CEILING = 0.74;

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
    return "safety";
}

export function estimateAdmissionDifficulty(candidate: Candidate): number {
    const reputation = candidate.university.reputation_score;
    const gpaFloor = candidate.program.gpa_min / 4;
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
