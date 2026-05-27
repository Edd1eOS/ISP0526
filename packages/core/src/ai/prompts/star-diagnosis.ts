// Star-chart end-flow diagnosis prompt.
//
// Called exactly once, after the user has lit up their constellation
// across all six nights. The model receives the consolidated pick list
// (already projected to ClarifyPatch shape on the caller side) plus the
// human-readable star labels, and returns a short, concrete readout:
//
//   - portrait:    one paragraph naming the direction the picks describe
//   - tradeoffs:   one paragraph naming the most material tension or
//                  risk that the picks expose (cost vs. ranking, etc.)
//   - next_steps:  three concrete, time-boundable actions
//
// Deliberately not horoscope-flavoured. The model must not invent
// institution names, program codes, fee numbers, or visa rules — those
// are produced by the rule engine downstream.

import { z } from "zod";

import type { Locale } from "./recommendation-narrative";

export const StarDiagnosisSchema = z
    .object({
        portrait: z.string().min(20).max(480),
        tradeoffs: z.string().min(20).max(360),
    });

export type StarDiagnosis = z.infer<typeof StarDiagnosisSchema>;

export interface StarPickLine {
    /** Night title, e.g. "方向". */
    readonly night: string;
    /** Labels the user picked for this night, in pick order. */
    readonly picks: ReadonlyArray<string>;
}

export interface StarDiagnosisPromptInput {
    readonly locale: Locale;
    readonly picks: ReadonlyArray<StarPickLine>;
    /** Optional Big-Five summary if assessment was completed. */
    readonly bigFive?: Readonly<Record<string, number>>;
    /** Optional free-form note the student left during the wish night. */
    readonly wishText?: string;
}

export const STAR_DIAGNOSIS_SYSTEM_PROMPT = [
    "You are an even-handed study-abroad counsellor.",
    "You produce a concise analytical readout from a student's intake constellation.",
    "STRICT RULES:",
    "- Do not invent universities, program names, fee numbers, IELTS thresholds, or visa rules.",
    "- Do not use horoscope, astrology, or destiny language.",
    "- portrait: 2-3 sentences synthesising what the student's picks collectively reveal about",
    "  their goals, priorities, and likely fit — concrete, not generic.",
    "- tradeoffs: 1-2 sentences naming the single most material tension in their profile",
    "  (e.g. budget vs. city preference vs. ranking, applied style vs. available programs).",
    "- Be specific: name the actual tension, not 'there are pros and cons'.",
    "- Output JSON exactly matching the schema. No prose outside JSON.",
].join("\n");

export function buildStarDiagnosisPrompt(
    input: StarDiagnosisPromptInput,
): string {
    const lang = input.locale === "en" ? "English" : "Simplified Chinese";
    const lines: string[] = [];
    lines.push(`Respond in ${lang}.`);
    lines.push("");
    lines.push("Student intake data:");
    for (const row of input.picks) {
        const items = row.picks.length === 0 ? "(skipped)" : row.picks.join(", ");
        lines.push(`- ${row.night}: ${items}`);
    }
    if (input.bigFive) {
        lines.push("");
        lines.push("Personality (Big Five 0..1):");
        for (const [k, v] of Object.entries(input.bigFive)) {
            lines.push(`- ${k}: ${v.toFixed(2)}`);
        }
    }
    const wish = input.wishText?.trim();
    if (wish) {
        lines.push("");
        lines.push("Student's notes (verbatim, do not paraphrase facts):");
        lines.push(wish.length > 800 ? `${wish.slice(0, 800)}…` : wish);
    }
    lines.push("");
    lines.push("Produce:");
    lines.push("- portrait: 2-3 sentences synthesising the student's profile, goals, and fit signals.");
    lines.push("- tradeoffs: 1-2 sentences on the most material tension or risk in their profile.");
    return lines.join("\n");
}
