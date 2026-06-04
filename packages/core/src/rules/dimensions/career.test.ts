import { describe, expect, it } from "vitest";
import { score, explain } from "./career";
import { buildProfile, fixtureCandidate } from "./__fixtures__";

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

    it("connects target field to adjacent program fields", () => {
        const csCandidate = {
            ...fixtureCandidate,
            program: {
                ...fixtureCandidate.program,
                field: "Computer Science",
            },
        };
        const aligned = score(
            buildProfile({ academic: { target_field: "Computing" } }),
            csCandidate,
        );
        const mismatched = score(
            buildProfile({ academic: { target_field: "Finance" } }),
            csCandidate,
        );
        expect(aligned).toBeGreaterThan(mismatched);
        expect(aligned).toBeGreaterThan(0.8);
    });
});

describe("career.explain", () => {
    it("comments on migration alignment when intent is high", () => {
        const reasons = explain(
            buildProfile({ career: { migration_intent: 5 } }),
            fixtureCandidate,
        );
        expect(reasons.some((r) => r.includes("移民"))).toBe(true);
    });

    it("explains field alignment when target_field is present", () => {
        const reasons = explain(
            buildProfile({ academic: { target_field: "Computing" } }),
            {
                ...fixtureCandidate,
                program: {
                    ...fixtureCandidate.program,
                    field: "Computer Science",
                },
            },
        );
        expect(reasons.some((r) => r.includes("计算机"))).toBe(true);
    });
});
