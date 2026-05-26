// Upload-summary prompt.
//
// Goal: take the raw text of a document the user dropped into the upload
// step (resume, transcript, recommendation letter, program brochure,
// scholarship invitation, etc.) and let the LLM produce a short, free-form
// summary the user can review before continuing.
//
// This is intentionally NOT the same path as intake-extraction. Extraction
// tries to fill ClarifyPatch fields (target_level, gpa, ielts, budget, ...)
// which is too rigid for non-resume documents. Here we ask the model to
// classify the document and surface its key points in natural language so
// the user can confirm "yes, that's roughly what this file says" before we
// move on.
//
// Hard rules:
//   - The model must NEVER invent facts. If something is not in the text,
//     it must be omitted.
//   - Output is locale-matched: zh for zh, en for en.
//   - All bullet points are short (<= 80 chars) and lifted from the text.

import { z } from "zod";

import type { Locale } from "./recommendation-narrative";

export type { Locale };

export const UPLOAD_DOC_KINDS = [
    "resume",
    "transcript",
    "recommendation_letter",
    "personal_statement",
    "offer_letter",
    "program_brochure",
    "scholarship_letter",
    "language_test_report",
    "other",
] as const;

export const UploadDocumentSummarySchema = z
    .object({
        // Best-guess classification. "other" is allowed and the UI shows it
        // as a plain "未识别类型" label.
        doc_kind: z.enum(UPLOAD_DOC_KINDS),
        // True if the document appears to describe the applicant themselves
        // (resume, transcript, personal statement). False for institution
        // material (brochures, program info sheets).
        about_applicant: z.boolean(),
        // Short single-sentence title of what this document is, in the
        // user's locale.
        title: z.string().min(2).max(80),
        // 3-7 key facts the user should confirm. Each item is a short
        // standalone sentence lifted/paraphrased from the source.
        key_points: z.array(z.string().min(2).max(160)).min(1).max(7),
        // Optional one-paragraph applicant snapshot. Present only when
        // about_applicant is true.
        applicant_summary: z.string().min(10).max(400).optional(),
    })
    .strict();

export type UploadDocumentSummary = z.infer<typeof UploadDocumentSummarySchema>;

export const UPLOAD_SUMMARY_SYSTEM_PROMPT = `You are an admissions assistant helping a Chinese student review documents they uploaded to a study-abroad intake form.

Your job is to:
1. Decide what kind of document the text is (doc_kind).
2. Decide whether the document is about the applicant themselves
   (about_applicant=true for their own resume / transcript / personal
   statement / language test report; false for school brochures or program
   info sheets they downloaded for reference).
3. Produce a short title and 3-7 standalone key points the user should
   verify.
4. If and only if about_applicant is true, write a one-paragraph
   applicant_summary (<= 400 chars) covering the most decision-relevant
   facts (level, field, GPA / scores, language ability, target country,
   budget hints).

Output rules:
- Never invent facts. If a value (GPA, IELTS, fees, dates) is not in the
  text, do not mention it.
- Locale: when the input locale is "zh", write title, key_points, and
  applicant_summary in Chinese. When "en", write in English.
- Keep each key_point under 80 characters when in Chinese, 120 in English.
- Strip noise: remove headers/footers/page numbers, watermark text,
  pagination artifacts, scanner OCR garbage.
- Do NOT include markdown, emoji, or bullet point markers — return raw
  strings inside the JSON array.

Return the JSON shape exactly matching the provided schema. No prose
outside the JSON object.`;

export function buildUploadSummaryUserPrompt(input: {
    readonly locale: Locale;
    readonly fileName: string;
    readonly text: string;
}): string {
    return [
        `Locale: ${input.locale}`,
        `File name: ${input.fileName}`,
        "---",
        "Document text (may be truncated):",
        input.text,
    ].join("\n");
}
