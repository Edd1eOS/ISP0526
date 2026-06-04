import { describe, expect, it } from "vitest";
import {
    ProgramSchema,
    UniversitySchema,
    type Candidate,
} from "../schemas/index";
import { scoreCandidate } from "./score";
import { recommend } from "./recommend";
import { getCandidates } from "../data/index";
import { buildProfile, fixtureCandidate } from "./dimensions/__fixtures__";

const accessibleCandidate: Candidate = {
    university: UniversitySchema.parse({
        id: "accessible-u",
        name_en: "Accessible University",
        name_zh: "Accessible University",
        country: "AU",
        city: "Sydney",
        city_size: "mega",
        climate: "subtropical",
        reputation_score: 0.65,
        chinese_community_density: 0.7,
        safety_index: 0.85,
        sources: [{ source_id: "t", kind: "url", url: "https://example.com/" }],
    }),
    program: ProgramSchema.parse({
        id: "accessible-master-it",
        university_id: "accessible-u",
        name_en: "Master of IT",
        name_zh: "Master of IT",
        level: "master",
        duration_years: 2,
        field: "Information Technology",
        teaching_style: "applied_heavy",
        gpa_min: 2.4,
        language_min: { ielts_overall: 6.5 },
        tuition: { currency: "AUD", annual: 45000 },
        tags: ["career_pipeline"],
        applied_ratio: 0.75,
        sources: [{ source_id: "t", kind: "url", url: "https://example.com/" }],
    }),
};

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

    it("uses admission risk, not GPA headroom alone, for bands", () => {
        const strong = scoreCandidate(
            buildProfile({ academic: { gpa: 3.9, ielts_overall: 7.5 } }),
            fixtureCandidate,
        );
        const weak = scoreCandidate(
            buildProfile({ academic: { gpa: 2.5, ielts_overall: 6.5 } }),
            fixtureCandidate,
        );
        expect(strong.band).toBe("match");
        expect(weak.band).toBe("match");
        expect(strong.final_score).toBeGreaterThan(weak.final_score);
    });

    it("allows genuinely lower-difficulty programs to be safety", () => {
        const out = scoreCandidate(
            buildProfile({ academic: { gpa: 3.8, ielts_overall: 7.5 } }),
            accessibleCandidate,
        );
        expect(out.band).toBe("safety");
    });

    it("does not mark MIT as safety for a high-GPA applicant", () => {
        const mit = getCandidates().find(
            (c) => c.program.id === "mit-master-finance",
        );
        expect(mit).toBeDefined();
        const out = scoreCandidate(
            buildProfile({
                academic: {
                    gpa: 3.95,
                    ielts_overall: 8.0,
                    target_field: "Finance",
                },
                budget: { annual_aud: 160000, flex: 0.1 },
                career: { internship_importance: 5 },
                preferred_tags: ["field_top", "career_pipeline"],
            }),
            mit!,
        );
        expect(out.band).toBe("stretch");
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

    it("does not force a safety bucket when the suitable pool is selective", () => {
        const { set } = recommend(
            buildProfile({
                academic: { gpa: 3.95, ielts_overall: 8.0, target_level: "master" },
                budget: { annual_aud: 100000, flex: 0.2 },
            }),
            getCandidates(),
        );
        const safetyIds = set.safety.map((s) => s.university_id);
        expect(safetyIds).not.toContain("mit");
        expect(safetyIds).not.toContain("stanford");
    });
});
