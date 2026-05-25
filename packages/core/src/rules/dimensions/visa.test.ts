import { describe, expect, it } from "vitest";
import { score, explain } from "./visa";
import { buildProfile, fixtureCandidate } from "./__fixtures__";
import { VisaRouteMapSchema, type VisaRouteMap } from "../../schemas/index";

const routes: VisaRouteMap = VisaRouteMapSchema.parse({
    AU: {
        country_name_en: "Australia",
        country_name_zh: "澳大利亚",
        visa_class: "Subclass 500",
        total_weeks_typical: 12,
        post_study_work_years: 2,
        steps: [
            { id: "coe", name_en: "CoE", weeks: 2 },
            { id: "lodge", name_en: "Lodge", weeks: 1 },
            { id: "grant", name_en: "Grant", weeks: 9 },
        ],
        source: {
            source_id: "test_au_visa",
            kind: "url",
            url: "https://example.com/au",
        },
    },
    UK: {
        country_name_en: "United Kingdom",
        country_name_zh: "英国",
        visa_class: "Student Route",
        total_weeks_typical: 6,
        post_study_work_years: 2,
        steps: [{ id: "cas", name_en: "CAS", weeks: 6 }],
        source: {
            source_id: "test_uk_visa",
            kind: "url",
            url: "https://example.com/uk",
        },
    },
});

describe("visa_feasibility", () => {
    it("returns a finite score in [0,1]", () => {
        const s = score(buildProfile(), fixtureCandidate, routes);
        expect(s).toBeGreaterThanOrEqual(0);
        expect(s).toBeLessThanOrEqual(1);
    });

    it("gives the migration_friendly tag a small bonus", () => {
        // fixtureCandidate already carries migration_friendly. Compare to a
        // synthetic candidate without that tag by mutating tags via the type
        // contract.
        const withTag = score(buildProfile(), fixtureCandidate, routes);
        const without = score(
            buildProfile(),
            {
                ...fixtureCandidate,
                program: { ...fixtureCandidate.program, tags: [] },
            },
            routes,
        );
        expect(withTag).toBeGreaterThan(without);
    });

    it("returns a neutral 0.5 when the country has no curated route", () => {
        const synthetic = {
            ...fixtureCandidate,
            university: { ...fixtureCandidate.university, country: "HK" as const },
        };
        const s = score(buildProfile(), synthetic, routes);
        expect(s).toBe(0.5);
    });

    it("explain cites the visa class and step count for known routes", () => {
        const lines = explain(buildProfile(), fixtureCandidate, routes);
        expect(lines.length).toBeGreaterThanOrEqual(2);
        expect(lines.join(" ")).toContain("Subclass 500");
    });
});
