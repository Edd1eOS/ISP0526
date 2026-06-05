// Hard thresholds used to filter out impossible candidates before scoring.
// Anything that survives the threshold gate is ranked by soft scores; nothing
// is silently dropped — every exclusion is recorded with a machine-readable
// reason so the report layer can show "we considered but excluded ..." flows.

import type { Candidate } from "../schemas/index";
import type { StudentProfile } from "../schemas/index";
import { getEffectiveGpa4 } from "./normalize/academic-grade";
import { estimateAdmissionDifficulty } from "./bands";

// Tolerance below program GPA minimum that still counts as "stretch reachable".
// 0.85 keeps a 15% headroom for normal programs so we surface aspirational
// candidates rather than only safe matches. Selective and elite programs use
// stricter floors so a far-below-line applicant is excluded rather than
// presented as a reachable stretch.
export const GPA_STRETCH_TOLERANCE = 0.85;
const GPA_TOLERANCE_SELECTIVE = 0.9;
const GPA_TOLERANCE_ELITE = 0.95;
const SELECTIVE_DIFFICULTY_FLOOR = 0.78;
const ELITE_DIFFICULTY_FLOOR = 0.88;

function gpaToleranceFor(candidate: Candidate): number {
    const difficulty = estimateAdmissionDifficulty(candidate);
    if (difficulty >= ELITE_DIFFICULTY_FLOOR) return GPA_TOLERANCE_ELITE;
    if (difficulty >= SELECTIVE_DIFFICULTY_FLOOR) return GPA_TOLERANCE_SELECTIVE;
    return GPA_STRETCH_TOLERANCE;
}

export type ExclusionReason =
    | { kind: "gpa_far_below_min"; required: number; observed: number }
    | { kind: "excluded_country"; country: string }
    | { kind: "study_level_mismatch"; required: string; observed: string }
    | { kind: "missing_required_tag"; tag: string };

export type ThresholdResult =
    | { kind: "pass" }
    | { kind: "exclude"; reason: ExclusionReason };

export function applyHardThresholds(
    profile: StudentProfile,
    candidate: Candidate,
): ThresholdResult {
    const { academic, hard_constraints } = profile;
    const { program, university } = candidate;

    if (hard_constraints.excluded_countries.includes(university.country)) {
        return {
            kind: "exclude",
            reason: { kind: "excluded_country", country: university.country },
        };
    }

    if (program.level !== academic.target_level) {
        return {
            kind: "exclude",
            reason: {
                kind: "study_level_mismatch",
                required: academic.target_level,
                observed: program.level,
            },
        };
    }

    const effectiveGpa = getEffectiveGpa4(profile);
    if (effectiveGpa !== undefined) {
        const threshold = program.gpa_min * gpaToleranceFor(candidate);
        if (effectiveGpa < threshold) {
            return {
                kind: "exclude",
                reason: {
                    kind: "gpa_far_below_min",
                    required: program.gpa_min,
                    observed: effectiveGpa,
                },
            };
        }
    }

    for (const required of hard_constraints.required_tags) {
        if (!program.tags.includes(required)) {
            return {
                kind: "exclude",
                reason: { kind: "missing_required_tag", tag: required },
            };
        }
    }

    return { kind: "pass" };
}
