// Shared fixtures for dimension unit tests.
// Construct realistic University / Program / StudentProfile instances via the
// Zod schemas so changes in the schema propagate to the test setup.

import {
    ProgramSchema,
    StudentProfileSchema,
    UniversitySchema,
    type Candidate,
    type Program,
    type StudentProfile,
    type University,
} from "../../schemas/index.js";

export const fixtureUniversity: University = UniversitySchema.parse({
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
    sources: [{ source_id: "t", kind: "url", url: "https://example.com/" }],
});

export const fixtureProgram: Program = ProgramSchema.parse({
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
    tags: ["field_top", "career_pipeline", "migration_friendly"],
    applied_ratio: 0.75,
    sources: [{ source_id: "t", kind: "url", url: "https://example.com/" }],
});

export const fixtureCandidate: Candidate = {
    program: fixtureProgram,
    university: fixtureUniversity,
};

export function buildProfile(
    overrides: Partial<{
        academic: Partial<StudentProfile["academic"]>;
        learning: Partial<StudentProfile["learning"]>;
        lifestyle: Partial<StudentProfile["lifestyle"]>;
        career: Partial<StudentProfile["career"]>;
        budget: Partial<StudentProfile["budget"]>;
        big_five: StudentProfile["big_five"];
        preferred_tags: StudentProfile["preferred_tags"];
    }> = {},
): StudentProfile {
    return StudentProfileSchema.parse({
        academic: { target_level: "master", ...(overrides.academic ?? {}) },
        learning: overrides.learning ?? {},
        lifestyle: overrides.lifestyle ?? {},
        career: overrides.career ?? {},
        budget: overrides.budget ?? { flex: 0 },
        ...(overrides.big_five !== undefined
            ? { big_five: overrides.big_five }
            : {}),
        preferred_tags: overrides.preferred_tags ?? [],
    });
}
