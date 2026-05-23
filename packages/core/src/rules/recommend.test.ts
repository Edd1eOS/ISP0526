import { describe, expect, it } from "vitest";
import { scoreCandidate } from "./score";
import { recommend } from "./recommend";
import { getCandidates } from "../data/index";
import { buildProfile, fixtureCandidate } from "./dimensions/__fixtures__";

describe("scoreCandidate", () => {
    it("returns a Score that satisfies the schema (>=3 reasons each cited)", () => {
        const out = scoreCandidate(
            buildProfile({ academic: { gpa: 3.4, ielts_overall: 7.0 } }),
            fixtureCandidate,
        );
        expect(out.reasons.length).toBeGreaterThanOrEqual(3);
        for (const r of out.reasons) expect(r.sources.length).toBeGreaterThan(0);
        expect(out.final_score).toBeGreaterThanOrEqual(0);
        expect(out.final_score).toBeLessThanOrEqual(100);
    });

    it("places a high-GPA applicant in safety, low-GPA in stretch", () => {
        const strong = scoreCandidate(
            buildProfile({ academic: { gpa: 3.9, ielts_overall: 7.5 } }),
            fixtureCandidate,
        );
        const weak = scoreCandidate(
            buildProfile({ academic: { gpa: 2.5, ielts_overall: 6.5 } }),
            fixtureCandidate,
        );
        expect(strong.band).toBe("safety");
        expect(weak.band).toBe("stretch");
        expect(strong.final_score).toBeGreaterThan(weak.final_score);
    });
});

describe("recommend (against AU seed data)", () => {
    it("returns at least one matched program for an average master applicant", () => {
        const profile = buildProfile({
            academic: { gpa: 3.2, ielts_overall: 7.0, target_level: "master" },
            budget: { annual_aud: 70000, flex: 0.1 },
            lifestyle: { city_size: "mega" },
        });
        const { set } = recommend(profile, getCandidates());
        const total = set.stretch.length + set.match.length + set.safety.length;
        expect(total).toBeGreaterThan(0);
    });

    it("respects bucket caps", () => {
        const { set } = recommend(
            buildProfile({ academic: { gpa: 3.5, target_level: "master" } }),
            getCandidates(),
        );
        expect(set.stretch.length).toBeLessThanOrEqual(5);
        expect(set.match.length).toBeLessThanOrEqual(10);
        expect(set.safety.length).toBeLessThanOrEqual(5);
    });

    it("excludes candidates whose study level is wrong", () => {
        const { excluded } = recommend(
            buildProfile({ academic: { target_level: "bachelor" } }),
            getCandidates(),
        );
        expect(
            excluded.every((e) => e.reason.kind === "study_level_mismatch"),
        ).toBe(true);
    });
});
