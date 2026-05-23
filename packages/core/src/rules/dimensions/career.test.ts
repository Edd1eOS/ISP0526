import { describe, expect, it } from "vitest";
import { score, explain } from "./career.js";
import { buildProfile, fixtureCandidate } from "./__fixtures__.js";

describe("career.score", () => {
    it("returns neutral baseline with no career signal", () => {
        expect(score(buildProfile(), fixtureCandidate)).toBeCloseTo(0.5, 2);
    });

    it("rewards a migration-intent + migration-friendly match", () => {
        // fixtureProgram has migration_friendly tag; high intent should align.
        const high = score(
            buildProfile({ career: { migration_intent: 5 } }),
            fixtureCandidate,
        );
        const low = score(
            buildProfile({ career: { migration_intent: 1 } }),
            fixtureCandidate,
        );
        expect(high).toBeGreaterThan(low);
    });

    it("rewards internship-importance when career_pipeline tag is present", () => {
        const v = score(
            buildProfile({ career: { internship_importance: 5 } }),
            fixtureCandidate,
        );
        expect(v).toBeCloseTo(1, 2);
    });
});

describe("career.explain", () => {
    it("comments on migration alignment when intent is high", () => {
        const reasons = explain(
            buildProfile({ career: { migration_intent: 5 } }),
            fixtureCandidate,
        );
        expect(reasons.some((r) => r.includes("migration"))).toBe(true);
    });
});
