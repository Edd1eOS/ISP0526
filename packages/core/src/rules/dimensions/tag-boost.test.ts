import { describe, expect, it } from "vitest";
import { score, explain } from "./tag-boost";
import { buildProfile, fixtureCandidate } from "./__fixtures__";

describe("tag-boost.score", () => {
    it("returns neutral baseline with no preferred tags", () => {
        expect(score(buildProfile(), fixtureCandidate)).toBeCloseTo(0.5, 2);
    });

    it("returns 1 when all preferred tags are present on the program", () => {
        const v = score(
            buildProfile({ preferred_tags: ["field_top", "career_pipeline"] }),
            fixtureCandidate,
        );
        expect(v).toBe(1);
    });

    it("returns 0 when no preferred tag matches", () => {
        const v = score(
            buildProfile({ preferred_tags: ["scholarship_rich"] }),
            fixtureCandidate,
        );
        expect(v).toBe(0);
    });
});

describe("tag-boost.explain", () => {
    it("lists hit tags when any preferred tag matches", () => {
        const reasons = explain(
            buildProfile({ preferred_tags: ["field_top"] }),
            fixtureCandidate,
        );
        expect(reasons.some((r) => r.includes("field_top"))).toBe(true);
    });
});
