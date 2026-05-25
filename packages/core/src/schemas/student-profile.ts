// StudentProfile contract.
//
// All input surfaces (form, conversational LLM, resume OCR, voice) normalize
// into this shape before the rule engine runs. Every preference field is
// optional — skipping a step yields `undefined`, which scoring functions treat
// as "no signal" rather than as a hard filter.

import { z } from "zod";
import {
    CitySizeSchema,
    ClimateSchema,
    CountrySchema,
    ProgramTagSchema,
    StudyLevelSchema,
    TeachingStyleSchema,
} from "./institution";

// Big Five via TIPI: each dimension 0..7.
const tipiDim = z.number().min(0).max(7);
export const BigFiveSchema = z.object({
    openness: tipiDim,
    conscientiousness: tipiDim,
    extraversion: tipiDim,
    agreeableness: tipiDim,
    neuroticism: tipiDim,
});
export type BigFive = z.infer<typeof BigFiveSchema>;

const likert5 = z.number().int().min(1).max(5);

export const LearningPreferenceSchema = z.object({
    class_size_small: likert5.optional(),
    prefers_applied: likert5.optional(),
    prefers_collaboration: likert5.optional(),
    fast_pace: likert5.optional(),
    teaching_style: TeachingStyleSchema.optional(),
});
export type LearningPreference = z.infer<typeof LearningPreferenceSchema>;

export const LifestylePreferenceSchema = z.object({
    city_size: CitySizeSchema.optional(),
    climate: ClimateSchema.optional(),
    chinese_community_min: z.number().min(0).max(1).optional(),
    safety_min: z.number().min(0).max(1).optional(),
    social_activity: likert5.optional(),
});
export type LifestylePreference = z.infer<typeof LifestylePreferenceSchema>;

export const CareerInterestsSchema = z.object({
    // Holland (RIASEC) interests, each normalized to 0..1. Underlying theory
    // (Holland 1959) is public domain; the items used to derive these are
    // authored in-house. NOT a clinical instrument — six items, one per type,
    // intended only as a soft signal to the recommender and to surface to the
    // student on their result review screen.
    realistic: z.number().min(0).max(1).optional(),
    investigative: z.number().min(0).max(1).optional(),
    artistic: z.number().min(0).max(1).optional(),
    social: z.number().min(0).max(1).optional(),
    enterprising: z.number().min(0).max(1).optional(),
    conventional: z.number().min(0).max(1).optional(),
});
export type CareerInterests = z.infer<typeof CareerInterestsSchema>;

export const CareerPreferenceSchema = z.object({
    migration_intent: likert5.optional(),
    return_home: likert5.optional(),
    internship_importance: likert5.optional(),
    salary_sensitivity: likert5.optional(),
    interests: CareerInterestsSchema.optional(),
});
export type CareerPreference = z.infer<typeof CareerPreferenceSchema>;

export const AcademicCredentialKindSchema = z.enum([
    // Tertiary transcript scales
    "gpa_4",
    "gpa_5",
    "wam_100",
    "percentage_100",
    "uk_class",
    "pass_fail",
    // Pre-tertiary / standardized exams
    "gaokao",
    "ap",
    "alevel",
    "ib",
    "sat",
    "act",
    // Free-form
    "certificate",
    "other",
]);
export type AcademicCredentialKind = z.infer<
    typeof AcademicCredentialKindSchema
>;

// A single raw academic signal the student volunteered. We never ask the
// student to convert to a 4.0 GPA; the rule engine normalizes downstream.
// `raw` accepts the student's literal answer ("680", "5,5,5,4,4", "A*AB",
// "二等一", "GPA 3.8/4.0", "pass"). `note` is an optional free-form qualifier
// (e.g. major average, year level, province).
export const AcademicCredentialSchema = z.object({
    kind: AcademicCredentialKindSchema,
    raw: z.string().min(1).max(200),
    note: z.string().max(200).optional(),
});
export type AcademicCredential = z.infer<typeof AcademicCredentialSchema>;

export const AcademicBackgroundSchema = z.object({
    // Legacy 4.0-scale GPA. Kept for back-compat with the form path and
    // pre-credentials seed data. New surfaces should populate `credentials`
    // instead and let the normalizer derive an effective GPA.
    gpa: z.number().min(0).max(4).optional(),
    credentials: z.array(AcademicCredentialSchema).default([]),
    ielts_overall: z.number().min(0).max(9).optional(),
    ielts_min_band: z.number().min(0).max(9).optional(),
    toefl_total: z.number().int().min(0).max(120).optional(),
    current_level: StudyLevelSchema.optional(),
    target_level: StudyLevelSchema,
    target_field: z.string().min(1).optional(),
});
export type AcademicBackground = z.infer<typeof AcademicBackgroundSchema>;

export const BudgetSchema = z.object({
    // Annual all-in budget in AUD (tuition + living). Optional — missing means
    // budget is a non-signal rather than a hard filter.
    annual_aud: z.number().int().positive().optional(),
    // Pads the budget on the high side; 0.1 = "stretch 10% if needed".
    flex: z.number().min(0).max(0.5).default(0),
});
export type Budget = z.infer<typeof BudgetSchema>;

export const HardConstraintsSchema = z.object({
    excluded_countries: z.array(CountrySchema).default([]),
    required_tags: z.array(ProgramTagSchema).default([]),
});
export type HardConstraints = z.infer<typeof HardConstraintsSchema>;

export const StudentProfileSchema = z.object({
    academic: AcademicBackgroundSchema,
    big_five: BigFiveSchema.optional(),
    learning: LearningPreferenceSchema.default({}),
    lifestyle: LifestylePreferenceSchema.default({}),
    career: CareerPreferenceSchema.default({}),
    budget: BudgetSchema.default({ flex: 0 }),
    hard_constraints: HardConstraintsSchema.default({
        excluded_countries: [],
        required_tags: [],
    }),
    // Tags the user explicitly opted into during the preference step.
    preferred_tags: z.array(ProgramTagSchema).default([]),
});
export type StudentProfile = z.infer<typeof StudentProfileSchema>;
