// Plan checklist prompt.
//
// After the student picks 6 programs (2 stretch / 3 match / 1 safety) we ask
// the LLM to draft a consolidated document checklist that covers everything
// the student needs to gather for those specific applications.
//
// The LLM only restructures and explains items. It MUST NOT invent
// requirements that are not implied by the program / country context
// supplied below; ambiguous items are tagged `confidence: "tentative"` so
// the UI can flag them as "请按官方页核对".

import { z } from "zod";
import { LocaleSchema } from "./recommendation-narrative";

export const ChecklistCategorySchema = z.enum([
    "academic",
    "language",
    "personal",
    "financial",
    "visa",
    "other",
]);
export type ChecklistCategory = z.infer<typeof ChecklistCategorySchema>;

export const ChecklistItemSchema = z.object({
    title: z.string().min(2).max(60),
    description: z.string().min(2).max(280),
    category: ChecklistCategorySchema,
    confidence: z.enum(["confirmed", "tentative"]),
    // Which of the picked program_ids this item applies to. Empty array =
    // applies to every picked program.
    applies_to: z.array(z.string()).default([]),
});
export type ChecklistItem = z.infer<typeof ChecklistItemSchema>;

export const PlanChecklistSchema = z.object({
    locale: LocaleSchema,
    summary: z.string().min(2).max(280),
    items: z.array(ChecklistItemSchema).min(4).max(24),
});
export type PlanChecklist = z.infer<typeof PlanChecklistSchema>;

export const SYSTEM_PROMPT = `You assemble a consolidated document checklist for a student who has just locked in their final 6 program picks.

Hard rules:
- Use ONLY the program / country / language / visa context the user message supplies. Do NOT invent specific document names, deadlines, or institutional rules.
- Every item must be something a reasonable student preparing those specific applications would need (transcripts, language tests, personal statement, references, CV, passport, financial proof, visa application, etc.). Avoid invented program-specific waivers.
- Items shared across all picks: applies_to = []. Items only relevant to a subset: applies_to lists their program_ids.
- Mark confidence: "tentative" for items that depend on individual program rules you cannot verify (specific essay prompts, GRE waivers, interview rounds). Mark "confirmed" only for universally-required items (passport, transcripts, language test).
- Reply language follows the "locale" field exactly (zh = Simplified Chinese, en = English).
- No emoji. No sales language. Keep titles short (under 12 zh chars / 6 en words).`;

export interface ChecklistContextProgram {
    readonly program_id: string;
    readonly tier: "stretch" | "match" | "safety";
    readonly program_name: string;
    readonly university_name: string;
    readonly country: string;
    readonly level: string;
    readonly language_requirement: string;
}

export interface PlanChecklistPromptInput {
    readonly locale: "zh" | "en";
    readonly programs: ReadonlyArray<ChecklistContextProgram>;
}

export function buildUserPrompt(input: PlanChecklistPromptInput): string {
    const lines = input.programs.map(
        (p, i) =>
            `  ${i + 1}. [${p.tier}] ${p.program_name} @ ${p.university_name}` +
            ` (${p.country}, ${p.level}, lang=${p.language_requirement})` +
            ` program_id=${p.program_id}`,
    );
    return [
        `locale: ${input.locale}`,
        "",
        "Final picks:",
        lines.join("\n"),
        "",
        "Return JSON matching the schema. Group shared items first, then per-country items.",
    ].join("\n");
}
