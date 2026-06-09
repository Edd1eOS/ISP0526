// Extraction-Agent (EA) prompt + output schema.
//
// EA reads the last assistant question + the latest student reply and
// returns a structured ClarifyPatch. It does NOT produce any conversational
// text. The Conversation Agent (CA) consumes the merged accumulated state
// in a separate LLM call.
//
// This split keeps the EA prompt focused on extraction heuristics
// (credentials parsing, enum normalization, Chinese context inference,
// skip detection) and lets the CA prompt focus on tone and phase logic.

import { z } from "zod";

import {
    ClarifyPatchSchema,
    type FormFieldKey,
} from "../intake-clarify/clarify-schema";

export const ExtractionOutputSchema = z.object({
    patch: ClarifyPatchSchema.optional(),
});
// No .strict() — silently strip any extra keys the LLM emits rather than
// throwing on the whole turn.

export type ExtractionOutput = z.infer<typeof ExtractionOutputSchema>;

export interface ExtractionPromptInput {
    readonly accumulated: Readonly<Record<string, unknown>>;
    readonly lockedKeys: ReadonlyArray<FormFieldKey>;
    readonly lastAssistantQuestion: string;
    readonly lastUserMessage: string;
}

export function buildExtractionSystemPrompt(
    input: ExtractionPromptInput,
): string {
    const lockedList =
        input.lockedKeys.length === 0
            ? "(none)"
            : input.lockedKeys.map((k) => `- ${k}`).join("\n");

    return `You extract structured intake fields from a Chinese student's reply in an ongoing study-abroad chat. Return ONLY a JSON object {patch?} matching the provided schema. NEVER produce conversational text — a separate agent owns the reply.

CONTEXT:
- Locked fields (do NOT overwrite — omit these from patch unless the student is explicitly correcting an earlier value):
${lockedList}
- Current accumulated state:
${JSON.stringify(input.accumulated, null, 2)}
- Last assistant question: ${input.lastAssistantQuestion || "(none)"}
- Latest student reply: ${input.lastUserMessage}

EXTRACTION RULES:
1. NEVER invent. If the student did not give a value for a field, OMIT it from the patch entirely.
2. Use EXACT enum strings. Allowed enums:
   - target_level: foundation | pathway | diploma | bachelor | master | phd
   - target_field: Information Technology | Computing | Data Science | Business | Business Administration | Finance | Civil Engineering | Electrical Engineering | Mechanical Engineering | Design | TESOL
   - teaching_style: theory_heavy | balanced | applied_heavy
   - city_size: mega | large | medium | small
   - preferred_tags (array, multi-select): field_top | migration_friendly | career_pipeline | value_for_money | scholarship_rich | chinese_community
3. Numeric normalization:
   - "20万" / "二十万" / "20w" without explicit currency -> assume CNY/year, convert to AUD by dividing by ~4.7. Examples: 20万 -> 42000, 30万 -> 64000, 50万 -> 106000.
   - "5万澳" / "5万 AUD" / "50k AUD" -> 50000 (no conversion).
   - "USD 30000" / "30k 美元" -> ~46000 AUD.
   - IELTS scores stay as-is, half-band granularity (e.g. 6.5, 7.0).
4. 学业成绩 (CRITICAL): never put gaokao / ap / a-level / wam etc. as top-level keys. Always emit them as ENTRIES in patch.credentials, each item shaped {"kind": "...", "raw": "...", "note"?: "..."}. Allowed kind values: gpa_4 | gpa_5 | wam_100 | percentage_100 | uk_class | pass_fail | gaokao | ap | alevel | ib | sat | act | certificate | other.
   Examples:
   - "高考 680" -> {"credentials": [{"kind": "gaokao", "raw": "680"}]}
   - "AP 5,5,4" -> {"credentials": [{"kind": "ap", "raw": "5,5,4"}]}
   - "本科 GPA 3.7" -> {"credentials": [{"kind": "gpa_4", "raw": "3.7"}]}
   - "WAM 78" -> {"credentials": [{"kind": "wam_100", "raw": "78"}]}
   - "A-level AAB" -> {"credentials": [{"kind": "alevel", "raw": "AAB"}]}
   The legacy top-level gpa field is ONLY for when the student explicitly states "GPA 3.x" on a 4.0 scale AND no other credential context is needed.
5. Vague Chinese terms map to the closest enum:
   - "工程" -> Civil Engineering (most common default)
   - "商科" / "商" -> Business
   - "计算机" / "CS" -> Computing
   - "IT" -> Information Technology
   - "数科" / "数据科学" -> Data Science
   - "金融" -> Finance
   - "设计" -> Design
6. Chinese education context inference:
   - "预科" / "foundation" / "foundation year" -> target_level = foundation.
   - "国际大一" / "桥梁课程" / "衔接课" / "pathway" -> target_level = pathway.
   - "文凭" / "diploma" / "certificate" / "postgraduate diploma" -> target_level = diploma.
   - "我是高考生" / "刚高考完" / "高三" / "高中生" -> target_level = bachelor.
   - "刚毕业" / "大四" / "本科在读" with study-abroad framing -> target_level = master (only if unambiguous).
   - "在读硕士" / "研究生在读" -> target_level = phd (only if context confirms).
7. Skip / decline detection: if the assistant's last question was clearly about ONE field AND the student replied with "不知道" / "不记得" / "随便" / "跳过" / "还没考" / "都行" / "你说呢" / nonsense / off-topic / pure punctuation, add that FormFieldKey to patch.skipped_fields. Valid FormFieldKey values: target_level | target_field | gpa | ielts_overall | teaching_style | city_size | annual_budget_aud | preferred_tags.
8. If the student gave nothing extractable AND is not declining anything, return {"patch": {}} or omit the patch field entirely.
9. NEVER write to a locked field. NEVER include keys outside the ClarifyPatch schema. NEVER paraphrase — only structured values.
10. Output only the JSON object. No prose, no markdown, no comments.`;
}
