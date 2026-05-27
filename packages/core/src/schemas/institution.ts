// University and Program contracts.
//
// Phase 1 stores these as static JSON in packages/core/data/. Each row is
// human-curated and carries source citations. The rule engine consumes these
// shapes directly; no I/O happens inside scoring functions.

import { z } from "zod";
import { ProgramIdSchema, UniversityIdSchema } from "./ids";
import { SourceCitationSchema } from "./source";

export const CountrySchema = z.enum([
    "AU",
    "US",
    "UK",
    "CA",
    "NZ",
    "HK",
    "SG",
    "MY",
    "TH",
    "DE",
    "NL",
    "IE",
    "RU",
    "TW",
    "MO",
]);
export type Country = z.infer<typeof CountrySchema>;

export const ProgramTagSchema = z.enum([
    "field_top",
    "value_for_money",
    "stepping_stone",
    "migration_friendly",
    "tuition_friendly",
    "scholarship_rich",
    "chinese_community",
    "career_pipeline",
]);
export type ProgramTag = z.infer<typeof ProgramTagSchema>;

export const StudyLevelSchema = z.enum(["foundation", "bachelor", "master", "phd"]);
export type StudyLevel = z.infer<typeof StudyLevelSchema>;

export const TeachingStyleSchema = z.enum([
    "theory_heavy",
    "balanced",
    "applied_heavy",
]);
export type TeachingStyle = z.infer<typeof TeachingStyleSchema>;

export const ClimateSchema = z.enum([
    "tropical",
    "subtropical",
    "temperate",
    "cold",
]);
export type Climate = z.infer<typeof ClimateSchema>;

export const CitySizeSchema = z.enum(["mega", "large", "medium", "small"]);
export type CitySize = z.infer<typeof CitySizeSchema>;

// 0..1 normalized score, e.g. global ranking percentile.
const unitInterval = z.number().min(0).max(1);

export const UniversitySchema = z.object({
    id: UniversityIdSchema,
    name_en: z.string().min(1),
    name_zh: z.string().min(1),
    country: CountrySchema,
    city: z.string().min(1),
    city_size: CitySizeSchema,
    climate: ClimateSchema,
    reputation_score: unitInterval,
    chinese_community_density: unitInterval,
    safety_index: unitInterval,
    sources: z.array(SourceCitationSchema).min(1),
});
export type University = z.infer<typeof UniversitySchema>;

// GPA is normalized to a 0..4 scale at the schema layer; conversion from
// percent / weighted average happens upstream in the input pipeline.
const gpa4 = z.number().min(0).max(4);

export const LanguageRequirementSchema = z.object({
    ielts_overall: z.number().min(0).max(9).optional(),
    ielts_min_band: z.number().min(0).max(9).optional(),
    toefl_total: z.number().int().min(0).max(120).optional(),
});
export type LanguageRequirement = z.infer<typeof LanguageRequirementSchema>;

export const TuitionSchema = z.object({
    currency: z.literal("AUD"),
    // Annual tuition, conservative public sticker price.
    annual: z.number().int().positive(),
});
export type Tuition = z.infer<typeof TuitionSchema>;

// ISO-8601 calendar date (YYYY-MM-DD). Times of day intentionally omitted.
const isoDate = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/u, "expected YYYY-MM-DD");

// Optional program-specific timeline milestones. Populated only when sourced
// from the program's official admissions page; otherwise consumers fall back
// to the country-level calendar template.
export const ProgramDeadlinesSchema = z.object({
    application_open: isoDate.optional(),
    application_deadline: isoDate.optional(),
    decision_by: isoDate.optional(),
    deposit_deadline: isoDate.optional(),
    intake_start: isoDate.optional(),
});
export type ProgramDeadlines = z.infer<typeof ProgramDeadlinesSchema>;

export const ProgramSchema = z.object({
    id: ProgramIdSchema,
    university_id: UniversityIdSchema,
    name_en: z.string().min(1),
    name_zh: z.string().min(1),
    level: StudyLevelSchema,
    duration_years: z.number().positive().max(8),
    field: z.string().min(1),
    teaching_style: TeachingStyleSchema,
    gpa_min: gpa4,
    language_min: LanguageRequirementSchema,
    tuition: TuitionSchema,
    tags: z.array(ProgramTagSchema).default([]),
    // Soft hint at applied vs theoretical; modulates personality fit.
    applied_ratio: unitInterval,
    deadlines: ProgramDeadlinesSchema.optional(),
    sources: z.array(SourceCitationSchema).min(1),
});
export type Program = z.infer<typeof ProgramSchema>;

// A program plus the resolved university record. Convenience shape passed to
// scoring functions so they never need to do a lookup themselves.
export const CandidateSchema = z.object({
    program: ProgramSchema,
    university: UniversitySchema,
});
export type Candidate = z.infer<typeof CandidateSchema>;
