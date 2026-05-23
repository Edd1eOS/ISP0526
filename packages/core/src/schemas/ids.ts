// Branded ID types and the helper builders that produce them.
// Strings stay as strings at runtime; the brand only exists at the type level
// to prevent accidentally passing, say, a UniversityId where a ProgramId is
// expected.

import { z } from "zod";

type Brand<T, B extends string> = T & { readonly __brand: B };

export type UniversityId = Brand<string, "UniversityId">;
export type ProgramId = Brand<string, "ProgramId">;
export type StudentProfileId = Brand<string, "StudentProfileId">;
export type RecommendationId = Brand<string, "RecommendationId">;
export type ReportCode = Brand<string, "ReportCode">;

// Slug-like IDs: lowercase letters, digits and dashes. Used for university and
// program records that live in version-controlled JSON.
const slugId = z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, "must be lowercase kebab-case");

export const UniversityIdSchema = slugId.transform((s) => s as UniversityId);
export const ProgramIdSchema = slugId.transform((s) => s as ProgramId);

// Surrogate UUIDs for runtime-issued records.
const uuid = z.string().uuid();
export const StudentProfileIdSchema = uuid.transform(
    (s) => s as StudentProfileId,
);
export const RecommendationIdSchema = uuid.transform(
    (s) => s as RecommendationId,
);

// Six-character report code shown to end users (display label: "report ID").
// Excludes the ambiguous glyphs 0, O, I, 1 to keep verbal handoff reliable.
export const ReportCodeSchema = z
    .string()
    .length(6)
    .regex(/^[A-HJ-NP-Z2-9]{6}$/, "must be 6 chars from the unambiguous alphabet")
    .transform((s) => s as ReportCode);
