// Schemas for the post-intake clarification chat.
//
// Tool / response shape is intentionally smaller than ExtractedProfile —
// only the fields the review form actually exposes. Enum values must match
// the form options 1:1 so the patch can be applied without translation.

import { z } from "zod";
import { AcademicCredentialSchema, CountrySchema } from "@isp0526/core";
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

export const FORM_FIELD_KEYS = [
    "target_level",
    "target_field",
    "gpa",
    "ielts_overall",
    "teaching_style",
    "city_size",
    "preferred_tags",
] as const;

export const ClarifyPatchSchema = z
    .object({
        target_level: z.enum(["bachelor", "master", "phd"]).optional(),
        target_field: z.enum(fieldEnumValues).optional(),
        // Legacy 4.0-scale GPA. Form path still uses this. Chat path should
        // populate `credentials` with the raw signal instead.
        gpa: z.number().min(0).max(4).optional(),
        // Raw academic credentials the student volunteered (gaokao score, AP
        // results, A-level grades, WAM, certificates, etc). The rule engine
        // normalizes these into an effective GPA; the LLM must NEVER convert.
        credentials: z.array(AcademicCredentialSchema).optional(),
        ielts_overall: z.number().min(0).max(9).optional(),
        teaching_style: z.enum(TEACHING_STYLE_VALUES).optional(),
        city_size: z.enum(CITY_SIZE_VALUES).optional(),
        annual_budget_aud: z.number().int().min(1000).max(500000).optional(),
        preferred_tags: z.array(z.enum(TAG_VALUES)).optional(),
        /** Countries the student explicitly wants to study in. When non-empty,
         *  all other countries are excluded from recommendations. */
        preferred_countries: z.array(CountrySchema).optional(),
        // Fields the user explicitly declined or that we gave up asking about
        // after repeated misses. Used by the chat layer to stop re-asking the
        // same question. Never written to the final StudentProfile.
        skipped_fields: z.array(z.enum(FORM_FIELD_KEYS)).optional(),
    })
    // No .strict() — silently strip any extra keys the LLM emits rather than
    // throwing a schema error and losing the whole turn.
    ;

export type ClarifyPatch = z.infer<typeof ClarifyPatchSchema>;

export const ClarifyTurnSchema = z
    .object({
        reply: z.string().min(1).max(400),
        patch: ClarifyPatchSchema.optional(),
        done: z.boolean(),
    });

export type ClarifyTurn = z.infer<typeof ClarifyTurnSchema>;

export type FormFieldKey =
    | "target_level"
    | "target_field"
    | "gpa"
    | "ielts_overall"
    | "teaching_style"
    | "city_size"
    | "preferred_tags";

export interface ClarifyMessage {
    readonly role: "user" | "assistant";
    readonly content: string;
}
