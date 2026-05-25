// Personality fit dimension.
//
// Blends the student's explicit learning preferences with their Big Five
// profile against the program's teaching style and applied/theoretical mix.
// All inputs are optional; the score degrades to a neutral 0.5 when nothing
// useful is known.

import type { Candidate, StudentProfile } from "../../schemas/index";
import { SCORING_WEIGHTS } from "../weights";

export const defaultWeight = SCORING_WEIGHTS.personality;

const NEUTRAL = 0.5;

const TEACHING_STYLE_ORDER = {
    theory_heavy: 0,
    balanced: 0.5,
    applied_heavy: 1,
} as const;

function appliedRatioFromLikert(likert: number): number {
    // Likert 1..5 -> 0..1, where 5 = strongly prefers applied learning.
    return (likert - 1) / 4;
}

export function score(profile: StudentProfile, candidate: Candidate): number {
    const { learning, big_five } = profile;
    const { program } = candidate;

    const parts: number[] = [];

    if (learning.teaching_style !== undefined) {
        const wantApplied = TEACHING_STYLE_ORDER[learning.teaching_style];
        const programApplied = TEACHING_STYLE_ORDER[program.teaching_style];
        parts.push(1 - Math.abs(wantApplied - programApplied));
    }

    if (learning.prefers_applied !== undefined) {
        const want = appliedRatioFromLikert(learning.prefers_applied);
        parts.push(1 - Math.abs(want - program.applied_ratio));
    }

    if (big_five !== undefined) {
        // High openness pairs better with theory-heavy programs; high
        // conscientiousness pairs better with applied/structured programs.
        const opennessPart =
            1 - Math.abs((big_five.openness / 7) - (1 - program.applied_ratio));
        const conscientiousPart =
            1 -
            Math.abs((big_five.conscientiousness / 7) - program.applied_ratio);
        parts.push((opennessPart + conscientiousPart) / 2);
    }

    if (parts.length === 0) return NEUTRAL;
    const sum = parts.reduce((acc, v) => acc + v, 0);
    return clamp01(sum / parts.length);
}

export function explain(
    profile: StudentProfile,
    candidate: Candidate,
): string[] {
    const reasons: string[] = [];
    const { learning } = profile;
    const { program } = candidate;

    if (learning.teaching_style !== undefined) {
        if (learning.teaching_style === program.teaching_style) {
            reasons.push(
                `项目授课风格（${styleLabel(program.teaching_style)}）与你的偏好一致。`,
            );
        } else {
            reasons.push(
                `项目授课风格为${styleLabel(program.teaching_style)}，你偏好${styleLabel(learning.teaching_style)}。`,
            );
        }
    }

    if (learning.prefers_applied !== undefined) {
        const ratioPct = Math.round(program.applied_ratio * 100);
        reasons.push(
            `项目约 ${ratioPct}% 实践、其余偏理论；你的实践偏好为 ${learning.prefers_applied}/5。`,
        );
    }

    if (reasons.length === 0) {
        reasons.push(
            "未提供性格与学习风格信号，采用中性匹配估值。",
        );
    }
    return reasons;
}

function styleLabel(s: string): string {
    const m: Record<string, string> = {
        applied_heavy: "偏实践",
        balanced: "实践与理论均衡",
        theory_heavy: "偏理论",
    };
    return m[s] ?? s;
}

function clamp01(n: number): number {
    return n < 0 ? 0 : n > 1 ? 1 : n;
}
