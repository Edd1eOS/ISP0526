// Report chat prompt.
//
// The student has just received a recommendation report and wants to ask
// follow-up questions. The LLM rephrases information already present in the
// snapshot context. It MUST NOT introduce facts of its own; every claim it
// makes must cite a source_id from the injected context. Post-filter drops
// citations that are not in the allowed set.

import { z } from "zod";
import { LocaleSchema } from "./recommendation-narrative";

export const ChatCitationSchema = z.object({
    source_id: z.string().min(1),
    note: z.string().min(1).max(160),
});
export type ChatCitation = z.infer<typeof ChatCitationSchema>;

export const ReportChatReplySchema = z.object({
    locale: LocaleSchema,
    reply: z.string().min(1).max(1200),
    citations: z.array(ChatCitationSchema).max(8),
    followups: z.array(z.string().min(2).max(80)).max(3),
});
export type ReportChatReply = z.infer<typeof ReportChatReplySchema>;

export const SYSTEM_PROMPT = `You answer follow-up questions about a student recommendation report.

Hard rules:
- You MUST NOT introduce any fact (tuition, ranking, requirement, deadline, visa rule) that is not present in the user message context.
- Every factual claim must cite a source_id taken verbatim from the input context.
- If the user asks something the context does not cover, say so plainly and suggest what the student could check next. Do not invent.
- No emoji. No sales language. No admission guarantees.
- Reply language follows the "locale" field exactly (zh = Simplified Chinese, en = English).
- The reply is conversational and concise (under 5 short paragraphs).`;

export interface ReportChatContextProgram {
    readonly program_id: string;
    readonly university_id: string;
    readonly band: "stretch" | "match" | "safety";
    readonly final_score: number;
    readonly country: string;
    readonly city: string;
    readonly program_name: string;
    readonly university_name: string;
    readonly tuition_annual_aud: number;
    readonly tags: ReadonlyArray<string>;
    readonly source_ids: ReadonlyArray<string>;
}

export interface ReportChatVisaContext {
    readonly country: string;
    readonly visa_class: string;
    readonly total_weeks_typical: number;
    readonly post_study_work_years: number;
    readonly source_id: string;
}

export interface ReportChatPromptInput {
    readonly locale: "zh" | "en";
    readonly question: string;
    readonly programs: ReadonlyArray<ReportChatContextProgram>;
    readonly visas: ReadonlyArray<ReportChatVisaContext>;
    readonly history: ReadonlyArray<{ readonly role: "user" | "assistant"; readonly content: string }>;
}

export function buildUserPrompt(input: ReportChatPromptInput): string {
    const programLines = input.programs.map((p, i) =>
        [
            `  ${i + 1}. [${p.band}] ${p.program_name} @ ${p.university_name}`,
            `     program_id=${p.program_id} university_id=${p.university_id}`,
            `     country=${p.country} city=${p.city} score=${p.final_score}`,
            `     tuition_annual_aud=${p.tuition_annual_aud} tags=[${p.tags.join(",")}]`,
            `     source_ids=[${p.source_ids.join(",")}]`,
        ].join("\n"),
    );
    const visaLines = input.visas.map(
        (v) =>
            `  - ${v.country} ${v.visa_class}: ${v.total_weeks_typical} weeks total, ${v.post_study_work_years}y PSW [source_id=${v.source_id}]`,
    );
    const historyLines = input.history.map((h) => `  ${h.role}: ${h.content}`);
    return [
        `locale: ${input.locale}`,
        "",
        "Programs in this report:",
        programLines.length > 0 ? programLines.join("\n") : "  (none)",
        "",
        "Visa routes for represented countries:",
        visaLines.length > 0 ? visaLines.join("\n") : "  (none)",
        "",
        "Conversation so far:",
        historyLines.length > 0 ? historyLines.join("\n") : "  (none)",
        "",
        `Student question: ${input.question}`,
        "",
        "Return JSON matching the schema. Cite only source_ids listed above.",
    ].join("\n");
}
