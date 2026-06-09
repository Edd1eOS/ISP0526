// Intake extraction prompt.
//
// Goal: take free-form text (resume, transcript, offer letter, chat blurb,
// voice transcript) and extract structured fields that map back into
// StudentProfile, each annotated with a confidence score and the verbatim
// source excerpt the model based the value on.
//
// We do NOT try to extract every field in StudentProfile here. The intake
// review page is the place where the user supplies anything we miss; the
// prompt only covers fields the model can reasonably infer from text:
//
//   - academic.gpa (normalized to 4.0 scale)
//   - academic.ielts_overall
//   - academic.toefl_total
//   - academic.current_level   (foundation / pathway / diploma / bachelor / master / phd)
//   - academic.target_level    (foundation / pathway / diploma / bachelor / master / phd)
//   - academic.target_field    (free-text discipline)
//   - budget.annual_aud        (AUD per year, integer)
//
// The model must NEVER invent. If a field is not mentioned, it must be
// omitted from the output. The post-extractor downstream applies a hard
// floor on confidence and clamps numeric ranges defensively.

import { z } from "zod";

import type { Locale } from "./recommendation-narrative";
import { StudyLevelSchema } from "../../schemas/institution";

export type { Locale };

const confidence = z.number().min(0).max(1);
// Short verbatim quote from the source text, used to show provenance in the
// review UI. Limited to keep prompt cost down and to discourage paraphrase.
const sourceExcerpt = z.string().min(1).max(240);

const numericField = <T extends z.ZodTypeAny>(value: T) =>
    z
        .object({
            value,
            confidence,
            source_excerpt: sourceExcerpt,
        })
        .strict();

const stringField = z
    .object({
        value: z.string().min(1).max(120),
        confidence,
        source_excerpt: sourceExcerpt,
    })
    .strict();

const levelField = z
    .object({
        value: StudyLevelSchema,
        confidence,
        source_excerpt: sourceExcerpt,
    })
    .strict();

export const ExtractedProfileSchema = z
    .object({
        academic: z
            .object({
                gpa: numericField(z.number().min(0).max(4)).optional(),
                ielts_overall: numericField(z.number().min(0).max(9)).optional(),
                toefl_total: numericField(
                    z.number().int().min(0).max(120),
                ).optional(),
                current_level: levelField.optional(),
                target_level: levelField.optional(),
                target_field: stringField.optional(),
            })
            .strict()
            .default({}),
        budget: z
            .object({
                annual_aud: numericField(
                    z.number().int().min(1000).max(500000),
                ).optional(),
            })
            .strict()
            .default({}),
        // Free-text notes the model considered relevant but did not fit any
        // structured slot (e.g. work experience, interests). Displayed but
        // not auto-applied; the user can copy from it during review.
        unstructured_notes: z.string().max(2000).optional(),
    })
    .strict();

export type ExtractedProfile = z.infer<typeof ExtractedProfileSchema>;

export const INTAKE_EXTRACTION_SYSTEM_PROMPT = `You extract structured study-abroad profile fields from free-form text supplied by a student.

Hard rules:
- You MUST NOT invent any fact. If a field is not even loosely supported by the source text, OMIT it entirely from the output.
- For every field you DO emit, include:
    1. value      - the normalized value (see schema)
    2. confidence - 0..1; use 0.9+ only when the source text is unambiguous, 0.6..0.9 when the value is reasonably implied, 0.4..0.6 when the source supports the field but requires assumption or normalization, < 0.4 only when guessing.
    3. source_excerpt - a verbatim quote from the source text (<= 240 chars) that supports the value. Do NOT paraphrase the source_excerpt.
- GPA must be normalized to a 4.0 scale. If the source uses a 100-scale or another scale, convert and lower the confidence by 0.1.
- IELTS overall is the overall band score, not a single sub-band.
- current_level / target_level must be one of: foundation, pathway, diploma, bachelor, master, phd. Use foundation for foundation year / preparatory year, pathway for bridge / international year-one routes, and diploma for diploma / certificate / postgraduate diploma routes.
- target_field is the discipline the student wants to study next (e.g. "Computer Science", "Public Health"), NOT the current major unless they are continuing. If the source uses a broad Chinese term like "工程" / "商科" / "计算机", normalize it to the closest English discipline name ("Engineering", "Business", "Computing") at confidence 0.55..0.7.
- budget.annual_aud is in Australian dollars per year, integer. The student is applying to study in Australia, so when an amount is given WITHOUT an explicit currency (e.g. "20万", "200k", "二十万"), default to interpreting it as AUD per year at confidence 0.5..0.65. If the source clearly says CNY / RMB / 人民币 / $ USD / GBP, convert at a sensible recent exchange rate and lower confidence by 0.1.
- Output language for unstructured_notes follows the top-level "locale" field (zh = Simplified Chinese, en = English). All other field values stay in their natural form (numbers, enums, English discipline names).
- No emoji. No marketing language.`;

export interface ExtractionPromptInput {
    readonly locale: Locale;
    readonly text: string;
}

export function buildExtractionUserPrompt(input: ExtractionPromptInput): string {
    return [
        `locale: ${input.locale}`,
        "",
        "--- source text begin ---",
        input.text.trim(),
        "--- source text end ---",
    ].join("\n");
}
