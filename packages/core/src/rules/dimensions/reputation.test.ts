import { describe, expect, it } from "vitest";
import { score, explain } from "./reputation";
import { buildProfile, fixtureCandidate } from "./__fixtures__";

describe("reputation.score", () => {
    it("blends university reputation with the field_top bonus", () => {
        const v = score(buildProfile(), fixtureCandidate);
        // 0.93 + 0.1 bonus, clamped to 1.
        expect(v).toBeCloseTo(1, 5);
    });

    it("stays within [0, 1]", () => {
        const v = score(buildProfile(), fixtureCandidate);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
    });
});

describe("reputation.explain", () => {
    it("mentions the reputation score", () => {
        const reasons = explain(buildProfile(), fixtureCandidate);
        expect(reasons.some((r) => r.includes("reputation score"))).toBe(true);
    });

    it("notes the field_top bonus when applicable", () => {
        const reasons = explain(buildProfile(), fixtureCandidate);
        expect(reasons.some((r) => r.includes("field-top"))).toBe(true);
    });
});
