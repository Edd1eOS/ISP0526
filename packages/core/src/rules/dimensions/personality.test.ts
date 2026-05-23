import { describe, expect, it } from "vitest";
import { score, explain } from "./personality";
import { buildProfile, fixtureCandidate } from "./__fixtures__";

describe("personality.score", () => {
    it("returns the neutral baseline with no signal", () => {
        expect(score(buildProfile(), fixtureCandidate)).toBeCloseTo(0.5, 2);
    });

    it("rewards an explicit teaching-style match", () => {
        const match = score(
            buildProfile({ learning: { teaching_style: "applied_heavy" } }),
            fixtureCandidate,
        );
        const mismatch = score(
            buildProfile({ learning: { teaching_style: "theory_heavy" } }),
            fixtureCandidate,
        );
        expect(match).toBeGreaterThan(mismatch);
    });

    it("stays within [0, 1] across Big Five extremes", () => {
        for (const v of [0, 3.5, 7]) {
            const result = score(
                buildProfile({
                    big_five: {
                        openness: v,
                        conscientiousness: 7 - v,
                        extraversion: 3.5,
                        agreeableness: 3.5,
                        neuroticism: 3.5,
                    },
                }),
                fixtureCandidate,
            );
            expect(result).toBeGreaterThanOrEqual(0);
            expect(result).toBeLessThanOrEqual(1);
        }
    });
});

describe("personality.explain", () => {
    it("notes a teaching-style match", () => {
        const reasons = explain(
            buildProfile({ learning: { teaching_style: "applied_heavy" } }),
            fixtureCandidate,
        );
        expect(reasons.some((r) => r.includes("matches your stated preference"))).toBe(
            true,
        );
    });

    it("falls back to neutral text with no inputs", () => {
        const reasons = explain(buildProfile(), fixtureCandidate);
        expect(reasons.some((r) => r.includes("neutral"))).toBe(true);
    });
});
