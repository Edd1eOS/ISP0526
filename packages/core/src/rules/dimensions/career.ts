// Career fit dimension.
//
// Rewards programs whose tags align with the student's career intent:
//   migration_intent  -> migration_friendly tag
//   internship signal -> career_pipeline tag
// Salary sensitivity is reserved for a future pass once we ship outcome data.

import type { Candidate, StudentProfile } from "../../schemas/index";
import { SCORING_WEIGHTS } from "../weights";

export const defaultWeight = SCORING_WEIGHTS.career;

const NEUTRAL = 0.5;

export function score(profile: StudentProfile, candidate: Candidate): number {
    const { career } = profile;
    const tags = new Set(candidate.program.tags);
    const parts: number[] = [];

    if (career.migration_intent !== undefined) {
        const intent = (career.migration_intent - 1) / 4; // 0..1
        const programOffers = tags.has("migration_friendly") ? 1 : 0;
        // High intent + offered = 1; high intent + missing = 0.
        parts.push(1 - Math.abs(intent - programOffers));
    }

    if (career.internship_importance !== undefined) {
        const want = (career.internship_importance - 1) / 4;
        const offers = tags.has("career_pipeline") ? 1 : 0;
        parts.push(1 - Math.abs(want - offers));
    }

    if (parts.length === 0) return NEUTRAL;
    return clamp01(parts.reduce((a, b) => a + b, 0) / parts.length);
}

export function explain(
    profile: StudentProfile,
    candidate: Candidate,
): string[] {
    const reasons: string[] = [];
    const tags = new Set(candidate.program.tags);
    const { career } = profile;

    if (career.migration_intent !== undefined && career.migration_intent >= 4) {
        reasons.push(
            tags.has("migration_friendly")
                ? "Program is tagged migration-friendly, aligned with your migration intent."
                : "Program is not tagged migration-friendly; weigh this against your migration intent.",
        );
    }
    if (
        career.internship_importance !== undefined &&
        career.internship_importance >= 4
    ) {
        reasons.push(
            tags.has("career_pipeline")
                ? "Program has a recognized career pipeline, supporting your internship priority."
                : "Program does not advertise a strong career pipeline; consider supplementing with internships.",
        );
    }
    if (reasons.length === 0) {
        reasons.push("No career preferences provided; defaulted to a neutral fit.");
    }
    return reasons;
}

function clamp01(n: number): number {
    return n < 0 ? 0 : n > 1 ? 1 : n;
}
