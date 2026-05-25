// Reputation dimension.
//
// Lightweight: read the university's reputation_score (already normalized in
// the data layer). A program tagged `field_top` adds a small bonus, capped at
// 1.0. The profile is unused — reputation is a candidate-only property — but
// the signature is kept symmetrical with other dimensions.

import type { Candidate, StudentProfile } from "../../schemas/index";
import { SCORING_WEIGHTS } from "../weights";

export const defaultWeight = SCORING_WEIGHTS.reputation;

const FIELD_TOP_BONUS = 0.1;

export function score(_profile: StudentProfile, candidate: Candidate): number {
    const base = candidate.university.reputation_score;
    const bonus = candidate.program.tags.includes("field_top")
        ? FIELD_TOP_BONUS
        : 0;
    return clamp01(base + bonus);
}

export function explain(
    _profile: StudentProfile,
    candidate: Candidate,
): string[] {
    const reasons: string[] = [
        `${candidate.university.name_zh ?? candidate.university.name_en} 的口碑归一化评分为 ${candidate.university.reputation_score.toFixed(2)}。`,
    ];
    if (candidate.program.tags.includes("field_top")) {
        reasons.push("项目被标为专业领域顶尖，额外加分。");
    }
    return reasons;
}

function clamp01(n: number): number {
    return n < 0 ? 0 : n > 1 ? 1 : n;
}
