import { describe, expect, it } from "vitest";
import { SCORING_WEIGHTS } from "./weights";
import { modulateWeights } from "./modulate";
import { buildProfile } from "./dimensions/__fixtures__";

const EPS = 1e-9;

function sum(values: number[]): number {
    return values.reduce((a, b) => a + b, 0);
}

describe("weights.ts", () => {
    it("default weights sum to exactly 1", () => {
        const total = sum(Object.values(SCORING_WEIGHTS));
        expect(Math.abs(total - 1)).toBeLessThan(EPS);
    });
});

describe("modulateWeights", () => {
    it("returns the defaults when no relevant signal is present", () => {
        const w = modulateWeights(buildProfile());
        for (const key of Object.keys(SCORING_WEIGHTS) as Array<
            keyof typeof SCORING_WEIGHTS
        >) {
            expect(w[key]).toBeCloseTo(SCORING_WEIGHTS[key], 5);
        }
    });

    it("doubles the budget weight when salary sensitivity is high, rescaled", () => {
        const w = modulateWeights(
            buildProfile({ career: { salary_sensitivity: 5 } }),
        );
        expect(w.budget).toBeGreaterThan(SCORING_WEIGHTS.budget);
        // Total stays at 1 after normalization.
        expect(Math.abs(sum(Object.values(w)) - 1)).toBeLessThan(EPS);
    });
});
