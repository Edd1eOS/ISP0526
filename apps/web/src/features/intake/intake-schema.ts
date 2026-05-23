// Intake form schema — a flat, FormData-friendly subset of StudentProfile
// that we normalize into the canonical profile shape before running the
// rule engine.
//
// We intentionally keep the form narrow for Phase 1: required fields drive
// hard thresholds; everything else is optional and contributes to scoring.

import { z } from "zod";
import {
    CitySizeSchema,
    ProgramTagSchema,
    StudyLevelSchema,
    StudentProfileSchema,
    TeachingStyleSchema,
    type StudentProfile,
} from "@isp0526/core";

const optionalNumber = (parser: z.ZodNumber) =>
    z
        .union([z.literal(""), z.string(), z.number()])
        .transform((v) => (v === "" || v === undefined ? undefined : Number(v)))
        .pipe(parser.optional());

export const IntakeFormSchema = z.object({
    target_level: StudyLevelSchema,
    target_field: z.string().trim().min(1).optional(),
    gpa: optionalNumber(z.number().min(0).max(4)),
    ielts_overall: optionalNumber(z.number().min(0).max(9)),
    teaching_style: TeachingStyleSchema.optional(),
    city_size: CitySizeSchema.optional(),
    annual_budget_aud: optionalNumber(z.number().int().positive()),
    preferred_tags: z.array(ProgramTagSchema).default([]),
});

export type IntakeFormValues = z.infer<typeof IntakeFormSchema>;

export function intakeToProfile(values: IntakeFormValues): StudentProfile {
    return StudentProfileSchema.parse({
        academic: {
            target_level: values.target_level,
            target_field: values.target_field,
            gpa: values.gpa,
            ielts_overall: values.ielts_overall,
        },
        learning: values.teaching_style
            ? { teaching_style: values.teaching_style }
            : {},
        lifestyle: values.city_size ? { city_size: values.city_size } : {},
        career: {},
        budget: {
            flex: 0,
            ...(values.annual_budget_aud
                ? { annual_aud: values.annual_budget_aud }
                : {}),
        },
        preferred_tags: values.preferred_tags,
    });
}

// FormData helpers (server actions hand us a FormData, not JSON).
export function parseIntakeFormData(formData: FormData): IntakeFormValues {
    const raw = {
        target_level: formData.get("target_level"),
        target_field: formData.get("target_field") || undefined,
        gpa: formData.get("gpa"),
        ielts_overall: formData.get("ielts_overall"),
        teaching_style: formData.get("teaching_style") || undefined,
        city_size: formData.get("city_size") || undefined,
        annual_budget_aud: formData.get("annual_budget_aud"),
        preferred_tags: formData.getAll("preferred_tags"),
    };
    return IntakeFormSchema.parse(raw);
}
