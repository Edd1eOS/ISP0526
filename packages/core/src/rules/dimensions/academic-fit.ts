// Academic fit dimension.
//
// Score is driven primarily by how far above the program's GPA floor the
// applicant sits, with a smaller contribution from language requirement
// headroom. Missing inputs degrade to a neutral 0.5 ("no signal") rather than
// to 0, so an unknown does not punish a candidate.

import type { Candidate, StudentProfile } from "../../schemas/index";
import { getEffectiveGpa4 } from "../normalize/academic-grade";
import { SCORING_WEIGHTS } from "../weights";

export const defaultWeight = SCORING_WEIGHTS.academic_fit;

const NEUTRAL = 0.5;

// Maps GPA delta vs program min onto a 0..1 curve.
// delta = -0.4  -> 0.0   (well below floor)
// delta =  0.0  -> 0.6   (exactly at floor: passing but unimpressive)
// delta = +0.7  -> 1.0   (comfortably above)
function gpaFitCurve(delta: number): number {
    const min = -0.4;
    const max = 0.7;
    const clamped = Math.max(min, Math.min(max, delta));
    // Linear interpolation across the band; piecewise pivot at 0.0 -> 0.6.
    if (clamped <= 0) {
        const t = (clamped - min) / (0 - min); // 0..1 across [-0.4, 0]
        return t * 0.6;
    }
    const t = clamped / max; // 0..1 across [0, 0.7]
    return 0.6 + t * 0.4;
}

function ieltsHeadroom(profile: StudentProfile, candidate: Candidate): number {
    const required = candidate.program.language_min.ielts_overall;
    const observed = profile.academic.ielts_overall;
    if (required === undefined || observed === undefined) return NEUTRAL;
    const diff = observed - required;
    if (diff <= -1) return 0;
    if (diff >= 1.5) return 1;
    return (diff + 1) / 2.5;
}

// TOEFL iBT headroom on the same 0..1 curve as IELTS, but expressed in raw
// score points. The bandwidth (~20 points) mirrors the IELTS bandwidth
// (2.5 bands) so the two curves are comparable in shape.
function toeflHeadroom(profile: StudentProfile, candidate: Candidate): number {
    const required = candidate.program.language_min.toefl_total;
    const observed = profile.academic.toefl_total;
    if (required === undefined || observed === undefined) return NEUTRAL;
    const diff = observed - required;
    if (diff <= -8) return 0;
    if (diff >= 12) return 1;
    return (diff + 8) / 20;
}

// Combined language headroom: take the better of IELTS / TOEFL signals so a
// program listing both requirements and a student providing either test get a
// usable signal. NEUTRAL acts as the floor when neither test pair lines up.
function languageHeadroom(
    profile: StudentProfile,
    candidate: Candidate,
): number {
    const ielts = ieltsHeadroom(profile, candidate);
    const toefl = toeflHeadroom(profile, candidate);
    // If only one of the two pairs has real data, the other returns NEUTRAL.
    // Math.max keeps the informative signal and falls back to NEUTRAL when
    // neither pair matched.
    return Math.max(ielts, toefl);
}

export function score(profile: StudentProfile, candidate: Candidate): number {
    const gpa = getEffectiveGpa4(profile);
    // Prefer the program's competitive (typical-cohort) GPA when available,
    // since gpa_min is often a published floor rather than what admits look
    // like in practice. Falls back to gpa_min otherwise.
    const reference =
        candidate.program.admission_profile?.competitive_gpa_4 ??
        candidate.program.gpa_min;
    const gpaPart =
        gpa === undefined || reference === undefined
            ? NEUTRAL
            : gpaFitCurve(gpa - reference);
    const langPart = languageHeadroom(profile, candidate);
    // GPA dominates academic fit (0.75) with language as a smaller modulator.
    return clamp01(gpaPart * 0.75 + langPart * 0.25);
}

export function explain(
    profile: StudentProfile,
    candidate: Candidate,
): string[] {
    const reasons: string[] = [];
    const gpa = getEffectiveGpa4(profile);
    const { ielts_overall } = profile.academic;
    const { program } = candidate;

    if (gpa !== undefined && program.gpa_min !== undefined) {
        const delta = gpa - program.gpa_min;
        if (delta >= 0.5) {
            reasons.push(
                `你的 GPA（${gpa.toFixed(2)}）充分超过项目下限 ${program.gpa_min.toFixed(2)}。`,
            );
        } else if (delta >= 0) {
            reasons.push(
                `你的 GPA（${gpa.toFixed(2)}）刚达项目下限 ${program.gpa_min.toFixed(2)}，余量有限。`,
            );
        } else {
            reasons.push(
                `你的 GPA（${gpa.toFixed(2)}）低于项目下限 ${program.gpa_min.toFixed(2)}，录取偏冲刺。`,
            );
        }
    }
    // When GPA is undefined the score already degrades to a neutral baseline;
    // we intentionally skip a "no data" reason here so the UI is not cluttered
    // with negative-shaped statements about what the user did not provide.

    const ieltsRequired = program.language_min.ielts_overall;
    if (ieltsRequired !== undefined && ielts_overall !== undefined) {
        const headroom = ielts_overall - ieltsRequired;
        if (headroom >= 0) {
            reasons.push(
                `雅思总分 ${ielts_overall.toFixed(1)} 达到项目要求的 ${ieltsRequired.toFixed(1)}。`,
            );
        } else {
            reasons.push(
                `雅思总分 ${ielts_overall.toFixed(1)} 低于项目要求的 ${ieltsRequired.toFixed(1)}。`,
            );
        }
    }

    const toeflRequired = program.language_min.toefl_total;
    const toeflObserved = profile.academic.toefl_total;
    if (toeflRequired !== undefined && toeflObserved !== undefined) {
        const headroom = toeflObserved - toeflRequired;
        if (headroom >= 0) {
            reasons.push(
                `托福总分 ${toeflObserved} 达到项目要求的 ${toeflRequired}。`,
            );
        } else {
            reasons.push(
                `托福总分 ${toeflObserved} 低于项目要求的 ${toeflRequired}。`,
            );
        }
    }

    return reasons;
}

function clamp01(n: number): number {
    if (n < 0) return 0;
    if (n > 1) return 1;
    return n;
}
