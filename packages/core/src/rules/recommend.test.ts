import { describe, expect, it } from "vitest";
import {
    type Country,
    ProgramSchema,
    type SelectivityTier,
    StudentProfileSchema,
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

function makeCountryMixCandidate(input: {
    band: "stretch" | "match" | "safety";
    country: Country;
    index: number;
    selectivity: SelectivityTier;
}): Candidate {
    const id = `${input.band}-${input.country.toLowerCase()}-${input.index}`;
    const universityId = `${id}-u`;
    return {
        university: UniversitySchema.parse({
            id: universityId,
            name_en: `${input.country} ${input.band} University ${input.index}`,
            name_zh: `${input.country} ${input.band} University ${input.index}`,
            country: input.country,
            city: "Test City",
            city_size: "large",
            climate: "temperate",
            reputation_score: 0.72,
            chinese_community_density: 0.5,
            safety_index: 0.82,
            sources: [{ source_id: id, kind: "url", url: `https://example.com/${id}` }],
        }),
        program: ProgramSchema.parse({
            id: `${id}-program`,
            university_id: universityId,
            name_en: `${input.band} Master`,
            name_zh: `${input.band} Master`,
            level: "master",
            duration_years: 2,
            field: "Information Technology",
            teaching_style: "balanced",
            gpa_min: 3.0,
            language_min: { ielts_overall: 6.5 },
            tuition: { currency: "AUD", annual: 52000 },
            tags: ["career_pipeline"],
            applied_ratio: 0.6,
            admission_profile: { selectivity: input.selectivity },
            sources: [{ source_id: id, kind: "url", url: `https://example.com/${id}` }],
        }),
    };
}

function countryMixCandidates(): Candidate[] {
    const out: Candidate[] = [];
    const specs: Array<{
        band: "stretch" | "match" | "safety";
        selectivity: SelectivityTier;
    }> = [
        { band: "stretch", selectivity: "elite" },
        { band: "match", selectivity: "selective" },
        { band: "safety", selectivity: "open" },
    ];
    for (const spec of specs) {
        for (let i = 0; i < 4; i++) {
            out.push(makeCountryMixCandidate({ ...spec, country: "AU", index: i }));
        }
        for (let i = 0; i < 3; i++) {
            out.push(makeCountryMixCandidate({ ...spec, country: "UK", index: i }));
            out.push(makeCountryMixCandidate({ ...spec, country: "CA", index: i }));
        }
    }
    return out;
}

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

    it("limits any one country to 45% of each recommendation band when alternatives exist", () => {
        const candidates = countryMixCandidates();
        const countryByProgram = new Map(
            candidates.map((c) => [c.program.id, c.university.country] as const),
        );
        const profile = StudentProfileSchema.parse({
            academic: {
                target_level: "master",
                gpa: 3.9,
                ielts_overall: 7.5,
            },
            hard_constraints: {
                preferred_countries: ["AU", "UK", "CA"],
                excluded_countries: [],
                required_tags: [],
            },
        });

        const { coverage, set } = recommend(profile, candidates);

        for (const band of ["stretch", "match", "safety"] as const) {
            const counts = new Map<string, number>();
            for (const score of set[band]) {
                const country = countryByProgram.get(score.program_id) ?? "unknown";
                counts.set(country, (counts.get(country) ?? 0) + 1);
            }
            const maxAllowed = Math.max(1, Math.floor(set[band].length * 0.45));
            expect(Math.max(...counts.values())).toBeLessThanOrEqual(maxAllowed);
            expect(coverage.country_diversity_limited[band]).toBe(false);
        }
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

    it("excludes elite programs when GPA is far below their stricter tolerance", () => {
        // MIT Master of Finance has gpa_min 3.5 and elite reputation, so the
        // stricter 0.95 tolerance gives a threshold of ~3.325. A 3.0 GPA is
        // safely above the legacy 0.85 threshold (2.975) but below the elite
        // floor, so it should be excluded for selectivity, not merely shown
        // as stretch.
        const { excluded } = recommend(
            buildProfile({
                academic: {
                    gpa: 3.0,
                    ielts_overall: 7.0,
                    target_level: "master",
                    target_field: "Finance",
                },
            }),
            getCandidates(),
        );
        const mitFinance = excluded.find(
            (e) => e.program_id === "mit-master-finance",
        );
        expect(mitFinance).toBeDefined();
        expect(mitFinance?.reason.kind).toBe("gpa_far_below_min");
    });

    it("emits coverage diagnostics with per-band counts and a sparse flag", () => {
        const { coverage, set } = recommend(
            buildProfile({
                academic: { gpa: 3.2, ielts_overall: 7.0, target_level: "master" },
            }),
            getCandidates(),
        );
        const total = set.stretch.length + set.match.length + set.safety.length;
        expect(coverage.per_band.stretch).toBe(set.stretch.length);
        expect(coverage.per_band.match).toBe(set.match.length);
        expect(coverage.per_band.safety).toBe(set.safety.length);
        expect(coverage.passing).toBeGreaterThanOrEqual(total);
        expect(coverage.after_country_cap).toBeLessThanOrEqual(coverage.passing);
        expect(coverage.after_fit_range).toBeLessThanOrEqual(
            coverage.after_country_cap,
        );
        if (total < 4) {
            expect(coverage.sparse).toBe(true);
            expect(coverage.reasons.length).toBeGreaterThan(0);
        }
    });
});

describe("scoreCandidate safety-eligibility guard", () => {
    // Selective (not elite) reputation tier so safetyEligible is the only
    // thing that can keep this out of safety; difficulty lands ~0.79.
    const selectiveCandidate: Candidate = {
        university: UniversitySchema.parse({
            id: "selective-u",
            name_en: "Selective University",
            name_zh: "Selective University",
            country: "AU",
            city: "Sydney",
            city_size: "mega",
            climate: "subtropical",
            reputation_score: 0.88,
            chinese_community_density: 0.6,
            safety_index: 0.85,
            sources: [{ source_id: "t", kind: "url", url: "https://example.com/" }],
        }),
        program: ProgramSchema.parse({
            id: "selective-master-cs",
            university_id: "selective-u",
            name_en: "Master of Computer Science",
            name_zh: "Master of Computer Science",
            level: "master",
            duration_years: 2,
            field: "Computer Science",
            teaching_style: "theory_heavy",
            gpa_min: 3.5,
            language_min: { toefl_total: 100 },
            tuition: { currency: "AUD", annual: 60000 },
            tags: ["career_pipeline"],
            applied_ratio: 0.6,
            sources: [{ source_id: "t", kind: "url", url: "https://example.com/" }],
        }),
    };

    it("does not label a selective TOEFL-only program as safety when the student has no language score", () => {
        const out = scoreCandidate(
            buildProfile({
                academic: { gpa: 3.95, target_level: "master" },
            }),
            selectiveCandidate,
        );
        expect(out.band).not.toBe("safety");
    });

    it("does not label a selective program as safety when GPA evidence is missing", () => {
        const out = scoreCandidate(
            buildProfile({
                academic: {
                    target_level: "master",
                    ielts_overall: 8.0,
                    toefl_total: 110,
                },
            }),
            selectiveCandidate,
        );
        expect(out.band).not.toBe("safety");
    });

    it("uses TOEFL headroom in academic-fit when the program is TOEFL-only", () => {
        const strong = scoreCandidate(
            buildProfile({
                academic: { gpa: 3.9, toefl_total: 115, target_level: "master" },
            }),
            selectiveCandidate,
        );
        const weak = scoreCandidate(
            buildProfile({
                academic: { gpa: 3.9, toefl_total: 90, target_level: "master" },
            }),
            selectiveCandidate,
        );
        expect(strong.breakdown.academic_fit).toBeGreaterThan(
            weak.breakdown.academic_fit,
        );
    });
});

describe("admission_profile integration", () => {
    // A program declared elite via admission_profile must be treated as elite
    // even if its raw reputation/gpa_min proxies would have placed it lower.
    const lowReputationElite: Candidate = {
        university: UniversitySchema.parse({
            id: "low-rep-elite-u",
            name_en: "Low-Rep Elite University",
            name_zh: "Low-Rep Elite University",
            country: "AU",
            city: "Sydney",
            city_size: "mega",
            climate: "subtropical",
            reputation_score: 0.7,
            chinese_community_density: 0.6,
            safety_index: 0.85,
            sources: [{ source_id: "t", kind: "url", url: "https://example.com/" }],
        }),
        program: ProgramSchema.parse({
            id: "low-rep-elite-master",
            university_id: "low-rep-elite-u",
            name_en: "Elite Master",
            name_zh: "Elite Master",
            level: "master",
            duration_years: 2,
            field: "Computer Science",
            teaching_style: "theory_heavy",
            gpa_min: 3.0,
            language_min: { ielts_overall: 6.5 },
            tuition: { currency: "AUD", annual: 60000 },
            tags: ["career_pipeline"],
            applied_ratio: 0.6,
            admission_profile: {
                selectivity: "elite",
                competitive_gpa_4: 3.9,
                required_tests: [],
                prerequisites: [],
            },
            sources: [{ source_id: "t", kind: "url", url: "https://example.com/" }],
        }),
    };

    it("treats a declared-elite program as stretch even with low reputation", () => {
        const out = scoreCandidate(
            buildProfile({
                academic: {
                    gpa: 3.95,
                    ielts_overall: 8.0,
                    target_level: "master",
                },
            }),
            lowReputationElite,
        );
        expect(out.band).toBe("stretch");
    });

    it("uses competitive_gpa_4 (not gpa_min) for academic-fit", () => {
        // gpa_min is 3.0, competitive is 3.9. A 3.2 GPA should look weak
        // against competitive_gpa_4 rather than comfortable against gpa_min.
        const weak = scoreCandidate(
            buildProfile({
                academic: { gpa: 3.2, ielts_overall: 7.0, target_level: "master" },
            }),
            lowReputationElite,
        );
        const strong = scoreCandidate(
            buildProfile({
                academic: { gpa: 3.9, ielts_overall: 7.0, target_level: "master" },
            }),
            lowReputationElite,
        );
        expect(strong.breakdown.academic_fit).toBeGreaterThan(
            weak.breakdown.academic_fit,
        );
        // 3.2 is well below 3.9 competitive; academic_fit should be modest.
        expect(weak.breakdown.academic_fit).toBeLessThan(0.55);
    });

    it("seeded elite US programs (mit-master-finance, stanford-master-computer-science) cannot be safety for a top applicant", () => {
        const { set } = recommend(
            buildProfile({
                academic: {
                    gpa: 3.95,
                    ielts_overall: 8.0,
                    toefl_total: 115,
                    target_level: "master",
                    target_field: "Computer Science",
                },
                budget: { annual_aud: 150000, flex: 0.2 },
            }),
            getCandidates(),
        );
        const safetyIds = set.safety.map((s) => s.program_id);
        expect(safetyIds).not.toContain("mit-master-finance");
        expect(safetyIds).not.toContain("stanford-master-computer-science");
        expect(safetyIds).not.toContain("ucl-msc-cs");
        expect(safetyIds).not.toContain("nus-master-computing");
    });
});
