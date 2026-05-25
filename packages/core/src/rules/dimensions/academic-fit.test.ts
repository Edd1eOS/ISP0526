import { describe, expect, it } from "vitest";
import {
    ProgramSchema,
    StudentProfileSchema,
    UniversitySchema,
    type Candidate,
    type StudentProfile,
} from "../../schemas/index";
import { score, explain } from "./academic-fit";

const university = UniversitySchema.parse({
    id: "unsw",
    name_en: "University of New South Wales",
    name_zh: "新南威尔士大学",
    country: "AU",
    city: "Sydney",
    city_size: "mega",
    climate: "subtropical",
    reputation_score: 0.93,
    chinese_community_density: 0.8,
    safety_index: 0.85,
    sources: [
        {
            source_id: "test_src",
            kind: "url",
            url: "https://example.com/",
        },
    ],
});

const program = ProgramSchema.parse({
    id: "unsw-master-of-it",
    university_id: "unsw",
    name_en: "Master of IT",
    name_zh: "信息技术硕士",
    level: "master",
    duration_years: 2,
    field: "Information Technology",
    teaching_style: "applied_heavy",
    gpa_min: 2.7,
    language_min: { ielts_overall: 6.5, ielts_min_band: 6.0 },
    tuition: { currency: "AUD", annual: 53760 },
    tags: ["field_top"],
    applied_ratio: 0.75,
    sources: [
        {
            source_id: "test_src",
            kind: "url",
            url: "https://example.com/",
        },
    ],
});

const candidate: Candidate = { program, university };

function profile(overrides: Partial<StudentProfile["academic"]>): StudentProfile {
    return StudentProfileSchema.parse({
        academic: {
            target_level: "master",
            ...overrides,
        },
    });
}

describe("academic-fit.score", () => {
    it("returns a neutral baseline when GPA and IELTS are missing", () => {
        expect(score(profile({}), candidate)).toBeCloseTo(0.5, 2);
    });

    it("rewards GPAs well above the program minimum", () => {
        const strong = score(profile({ gpa: 3.6, ielts_overall: 7.5 }), candidate);
        const weak = score(profile({ gpa: 2.7, ielts_overall: 6.5 }), candidate);
        expect(strong).toBeGreaterThan(weak);
        expect(strong).toBeGreaterThan(0.85);
    });

    it("clamps to 0 when GPA is far below the minimum", () => {
        const result = score(profile({ gpa: 2.3 }), candidate);
        expect(result).toBeLessThan(0.4);
        expect(result).toBeGreaterThanOrEqual(0);
    });

    it("never returns a value outside [0, 1]", () => {
        for (const gpa of [0, 1, 2.5, 2.7, 3.0, 3.5, 4.0]) {
            const v = score(profile({ gpa, ielts_overall: 7.0 }), candidate);
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThanOrEqual(1);
        }
    });
});

describe("academic-fit.explain", () => {
    it("emits no reasons when no academic data is provided", () => {
        const reasons = explain(profile({}), candidate);
        // The dimension intentionally degrades to a neutral score without
        // surfacing a \"no data\" bullet, so the UI is never cluttered with
        // negative-shaped statements about missing inputs.
        expect(reasons).toEqual([]);
    });

    it("flags strong GPA headroom", () => {
        const reasons = explain(profile({ gpa: 3.6 }), candidate);
        expect(reasons.some((r) => r.includes("充分超过"))).toBe(true);
    });

    it("flags GPA below the minimum as aspirational", () => {
        const reasons = explain(profile({ gpa: 2.5 }), candidate);
        expect(reasons.some((r) => r.includes("偏冲刺"))).toBe(true);
    });
});
