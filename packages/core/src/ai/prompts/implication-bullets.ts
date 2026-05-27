// Implication bullets prompt.
//
// Called from the QuestionEngine when the student has filled a high-impact
// fact (target_field, city_size, budget) but has not yet been confronted
// with what that choice actually implies day-to-day. The model returns 3
// short reality-check bullets that the UI renders as a confirm card.
//
// Depth-aware:
//   depth=0: broad bullets about the topic itself.
//   depth=1: narrower follow-up focused on the specific bullet the student
//            flagged as "I hadn't thought of that". Each bullet here MUST
//            offer a binary lower-stakes choice the student can react to,
//            so the UI can render two clickable options.
//   depth=2: not used by the prompt — engine treats topic as skipped.
//
// STRICT RULES:
//   - No invented universities, fees, IELTS thresholds, or visa rules.
//   - No horoscope, destiny, or "you are a..." prose.
//   - Bullets must be concrete, fact-shaped, 8..60 chars Chinese / EN.

import { z } from "zod";

import type { Locale } from "./recommendation-narrative";

export const ImplicationBulletSchema = z.object({
    /** Short bullet body. */
    body: z.string().min(8).max(60),
    /** Optional binary choices (used at depth >= 1). When present, must
     *  contain exactly two short options. */
    options: z
        .array(z.string().min(2).max(24))
        .min(2)
        .max(2)
        .optional(),
});

export type ImplicationBullet = z.infer<typeof ImplicationBulletSchema>;

export const ImplicationBulletsSchema = z.object({
    /** Short headline rephrasing the topic. */
    headline: z.string().min(4).max(48),
    bullets: z.array(ImplicationBulletSchema).min(3).max(3),
});

export type ImplicationBullets = z.infer<typeof ImplicationBulletsSchema>;

export type ImplicationTopic =
    | "field_implications"
    | "city_implications"
    | "budget_implications";

export interface ImplicationBulletsPromptInput {
    readonly locale: Locale;
    readonly topic: ImplicationTopic;
    /** 0 = first ask. 1 = follow-up on a flagged bullet. */
    readonly depth: 0 | 1;
    /** Verbatim primary fact the bullets must talk about. */
    readonly subject: string;
    /** Other context the model can use (city, budget, etc). */
    readonly facts?: Readonly<Record<string, string>>;
    /** Only at depth >= 1: the bullet the student flagged. */
    readonly unclearBullet?: string;
}

export const IMPLICATION_BULLETS_SYSTEM_PROMPT = [
    "You are an even-handed study-abroad counsellor.",
    "Given a single high-impact intake fact (a study direction, a city",
    "size, or an annual budget level), you produce 3 short bullets that",
    "name material implications the student may not have considered.",
    "STRICT RULES:",
    "- Do not invent universities, program names, fee numbers, IELTS",
    "  thresholds, or visa rules.",
    "- Do not use horoscope, destiny, or fate language.",
    "- Each bullet must be a concrete, day-to-day reality, not abstract",
    "  praise or warnings.",
    "- At depth >= 1, every bullet MUST include an `options` tuple",
    "  offering two specific, lower-stakes choices the student can pick.",
    "- Output JSON exactly matching the schema. No prose outside JSON.",
].join("\n");

export function buildImplicationBulletsPrompt(
    input: ImplicationBulletsPromptInput,
): string {
    const lang = input.locale === "en" ? "English" : "Simplified Chinese";
    const lines: string[] = [];
    lines.push(`Respond in ${lang}.`);
    lines.push(`Topic: ${input.topic}`);
    lines.push(`Subject: ${input.subject}`);
    if (input.facts) {
        for (const [k, v] of Object.entries(input.facts)) {
            lines.push(`Fact ${k}: ${v}`);
        }
    }
    lines.push("");
    if (input.depth === 0) {
        lines.push(
            "Produce 3 bullets naming concrete implications of the subject.",
        );
        lines.push("Do NOT include `options` at depth 0.");
    } else {
        lines.push(
            "The student previously flagged that they had not considered:",
        );
        lines.push(`"${input.unclearBullet ?? ""}"`);
        lines.push("");
        lines.push(
            "Produce 3 narrower follow-up bullets, each WITH an `options`",
        );
        lines.push(
            "tuple of two short choices the student can react to instantly.",
        );
    }
    return lines.join("\n");
}
