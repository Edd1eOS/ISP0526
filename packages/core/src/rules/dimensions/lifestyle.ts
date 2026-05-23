// Lifestyle fit dimension.
//
// Compares the student's lifestyle preferences (city size, climate, chinese
// community density floor, safety floor) against the candidate university's
// attributes. Missing preferences contribute neutrally; explicit floors below
// university values reduce the score but never to zero — Phase 1 treats them
// as ranking signal, not as hard cuts.

import type { Candidate, StudentProfile } from "../../schemas/index";
import { SCORING_WEIGHTS } from "../weights";

export const defaultWeight = SCORING_WEIGHTS.lifestyle;

const NEUTRAL = 0.5;

const CITY_SIZE_ORDER = {
    small: 0,
    medium: 1 / 3,
    large: 2 / 3,
    mega: 1,
} as const;

const CLIMATE_ORDER = {
    tropical: 0,
    subtropical: 1 / 3,
    temperate: 2 / 3,
    cold: 1,
} as const;

export function score(profile: StudentProfile, candidate: Candidate): number {
    const { lifestyle } = profile;
    const { university } = candidate;

    const parts: number[] = [];

    if (lifestyle.city_size !== undefined) {
        const want = CITY_SIZE_ORDER[lifestyle.city_size];
        const have = CITY_SIZE_ORDER[university.city_size];
        parts.push(1 - Math.abs(want - have));
    }

    if (lifestyle.climate !== undefined) {
        const want = CLIMATE_ORDER[lifestyle.climate];
        const have = CLIMATE_ORDER[university.climate];
        parts.push(1 - Math.abs(want - have));
    }

    if (lifestyle.chinese_community_min !== undefined) {
        const diff =
            university.chinese_community_density - lifestyle.chinese_community_min;
        parts.push(diff >= 0 ? 1 : clamp01(1 + diff * 2));
    }

    if (lifestyle.safety_min !== undefined) {
        const diff = university.safety_index - lifestyle.safety_min;
        parts.push(diff >= 0 ? 1 : clamp01(1 + diff * 2));
    }

    if (parts.length === 0) return NEUTRAL;
    return clamp01(parts.reduce((a, b) => a + b, 0) / parts.length);
}

export function explain(
    profile: StudentProfile,
    candidate: Candidate,
): string[] {
    const reasons: string[] = [];
    const { lifestyle } = profile;
    const { university } = candidate;

    if (lifestyle.city_size !== undefined) {
        if (lifestyle.city_size === university.city_size) {
            reasons.push(
                `${university.name_en} sits in a ${university.city_size} city, matching your preference.`,
            );
        } else {
            reasons.push(
                `${university.name_en} sits in a ${university.city_size} city; you preferred ${lifestyle.city_size}.`,
            );
        }
    }
    if (lifestyle.climate !== undefined) {
        reasons.push(
            `City climate is ${university.climate}; you preferred ${lifestyle.climate}.`,
        );
    }
    if (lifestyle.chinese_community_min !== undefined) {
        reasons.push(
            `Local Chinese community density estimate ${university.chinese_community_density.toFixed(2)} vs your floor ${lifestyle.chinese_community_min.toFixed(2)}.`,
        );
    }
    if (reasons.length === 0) {
        reasons.push("No lifestyle preferences provided; defaulted to a neutral fit.");
    }
    return reasons;
}

function clamp01(n: number): number {
    return n < 0 ? 0 : n > 1 ? 1 : n;
}
