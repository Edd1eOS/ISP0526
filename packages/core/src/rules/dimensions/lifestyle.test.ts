import { describe, expect, it } from "vitest";
import { score, explain } from "./lifestyle.js";
import { buildProfile, fixtureCandidate } from "./__fixtures__.js";

describe("lifestyle.score", () => {
    it("returns neutral baseline with no preferences", () => {
        expect(score(buildProfile(), fixtureCandidate)).toBeCloseTo(0.5, 2);
    });

    it("rewards matching city size", () => {
        const match = score(
            buildProfile({ lifestyle: { city_size: "mega" } }),
            fixtureCandidate,
        );
        const mismatch = score(
            buildProfile({ lifestyle: { city_size: "small" } }),
            fixtureCandidate,
        );
        expect(match).toBeGreaterThan(mismatch);
        expect(match).toBeCloseTo(1, 2);
    });

    it("respects the chinese community floor", () => {
        const meets = score(
            buildProfile({ lifestyle: { chinese_community_min: 0.5 } }),
            fixtureCandidate,
        );
        const below = score(
            buildProfile({ lifestyle: { chinese_community_min: 0.95 } }),
            fixtureCandidate,
        );
        expect(meets).toBeGreaterThan(below);
    });
});

describe("lifestyle.explain", () => {
    it("describes a city-size match", () => {
        const reasons = explain(
            buildProfile({ lifestyle: { city_size: "mega" } }),
            fixtureCandidate,
        );
        expect(reasons.some((r) => r.includes("matching your preference"))).toBe(true);
    });
});
