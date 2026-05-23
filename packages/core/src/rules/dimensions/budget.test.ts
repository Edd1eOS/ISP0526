import { describe, expect, it } from "vitest";
import { score, explain } from "./budget";
import { buildProfile, fixtureCandidate } from "./__fixtures__";

describe("budget.score", () => {
    it("returns neutral baseline when no budget is provided", () => {
        expect(score(buildProfile(), fixtureCandidate)).toBeCloseTo(0.5, 2);
    });

    it("rewards budgets comfortably above tuition", () => {
        const v = score(
            buildProfile({ budget: { annual_aud: 100000, flex: 0 } }),
            fixtureCandidate,
        );
        expect(v).toBeGreaterThan(0.8);
    });

    it("penalizes tuition above the effective budget", () => {
        const v = score(
            buildProfile({ budget: { annual_aud: 30000, flex: 0 } }),
            fixtureCandidate,
        );
        expect(v).toBeLessThan(0.5);
    });

    it("returns 0 when tuition is 50% or more over budget", () => {
        const v = score(
            buildProfile({ budget: { annual_aud: 20000, flex: 0 } }),
            fixtureCandidate,
        );
        expect(v).toBe(0);
    });
});

describe("budget.explain", () => {
    it("calls out a fit when tuition is within budget", () => {
        const reasons = explain(
            buildProfile({ budget: { annual_aud: 80000, flex: 0 } }),
            fixtureCandidate,
        );
        expect(reasons.some((r) => r.includes("fits within"))).toBe(true);
    });
});
