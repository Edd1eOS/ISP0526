// Schemas for the post-intake clarification chat.
//
// Tool / response shape is intentionally smaller than ExtractedProfile —
// only the fields the review form actually exposes. Enum values must match
// the form options 1:1 so the patch can be applied without translation.

import { z } from "zod";
import { FIELD_OPTIONS } from "../intake/field-options";

const fieldEnumValues = FIELD_OPTIONS
    .map((o) => o.value)
    .filter((v) => v.length > 0) as [string, ...string[]];

export const TEACHING_STYLE_VALUES = [
    "theory_heavy",
    "balanced",
    "applied_heavy",
] as const;

export const CITY_SIZE_VALUES = ["mega", "large", "medium", "small"] as const;

export const TAG_VALUES = [
    "field_top",
    "migration_friendly",
    "career_pipeline",
    "value_for_money",
    "scholarship_rich",
    "chinese_community",
] as const;

export const ClarifyPatchSchema = z
    .object({
        target_level: z.enum(["bachelor", "master", "phd"]).optional(),
        target_field: z.enum(fieldEnumValues).optional(),
        gpa: z.number().min(0).max(4).optional(),
        ielts_overall: z.number().min(0).max(9).optional(),
        teaching_style: z.enum(TEACHING_STYLE_VALUES).optional(),
        city_size: z.enum(CITY_SIZE_VALUES).optional(),
        annual_budget_aud: z.number().int().min(1000).max(500000).optional(),
        preferred_tags: z.array(z.enum(TAG_VALUES)).optional(),
    })
    .strict();

export type ClarifyPatch = z.infer<typeof ClarifyPatchSchema>;

export const ClarifyTurnSchema = z
    .object({
        reply: z.string().min(1).max(400),
        patch: ClarifyPatchSchema.optional(),
        done: z.boolean(),
    })
    .strict();

export type ClarifyTurn = z.infer<typeof ClarifyTurnSchema>;

export type FormFieldKey =
    | "target_level"
    | "target_field"
    | "gpa"
    | "ielts_overall"
    | "teaching_style"
    | "city_size"
    | "annual_budget_aud"
    | "preferred_tags";

export interface ClarifyMessage {
    readonly role: "user" | "assistant";
    readonly content: string;
}
