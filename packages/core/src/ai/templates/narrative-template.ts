// Deterministic template-driven narrative generator. Same input/output
// contract as the LLM adapter, so the UI can swap between the two without
// caring which one produced the text.
//
// Phase 1 ships this template as the primary path - no API cost, no
// fallback flicker. The LLM adapter exists for later phases when we want
// fluent rephrasing.

import type { Candidate, Score } from "../../schemas/index";
import {
    RecommendationNarrativeSchema,
    type Locale,
    type RecommendationNarrative,
} from "../prompts/recommendation-narrative";

const MAX_PROS = 5;
const SUMMARY_MIN = 40;

interface CopyPack {
    summaryLeadIn: (params: { band: Score["band"]; school: string; programName: string }) => string;
    bandLabel: Record<Score["band"], string>;
}

const COPY: Record<Locale, CopyPack> = {
    zh: {
        summaryLeadIn: ({ band, school, programName }) =>
            `${school} · ${programName} 与你的输入${COPY.zh.bandLabel[band]}匹配。下面这些点来自规则引擎对你的画像与项目数据的逐项比对。`,
        bandLabel: {
            stretch: "存在挑战但仍值得尝试",
            match: "整体",
            safety: "充分",
        },
    },
    en: {
        summaryLeadIn: ({ band, school, programName }) =>
            `${programName} at ${school} is a ${COPY.en.bandLabel[band]} for the inputs you provided. The points below come from the rule engine comparing your profile against the program data, item by item.`,
        bandLabel: {
            stretch: "stretch fit",
            match: "match",
            safety: "safety pick",
        },
    },
};

export function renderTemplateNarrative(
    score: Score,
    candidate: Candidate,
    locale: Locale,
): RecommendationNarrative {
    const programName = locale === "zh"
        ? candidate.program.name_zh
        : candidate.program.name_en;
    const school = locale === "zh"
        ? candidate.university.name_zh
        : candidate.university.name_en;

    const reasonPool = score.reasons.filter(
        (r) => r.text.length >= 4 && r.sources[0],
    );
    const top = reasonPool.slice(0, MAX_PROS);
    const pros = top.map((r) => ({
        text: clip(r.text, 4, 160),
        source_id: r.sources[0]!.source_id,
    }));

    // Schema requires >= 2 pros. If the engine somehow yields fewer, pad with
    // a generic statement carrying the dimension-level rule citation so the
    // template never fails validation.
    while (pros.length < 2 && reasonPool[0]) {
        pros.push({
            text: locale === "zh"
                ? "整体匹配良好（详见上方维度评分）。"
                : "Overall fit looks solid (see dimension breakdown above).",
            source_id: reasonPool[0].sources[0]!.source_id,
        });
    }

    const leadIn = COPY[locale].summaryLeadIn({
        band: score.band,
        school,
        programName,
    });
    const bullets = top.slice(0, 3).map((r) => r.text).join(locale === "zh" ? " " : " ");
    const summary = clip(`${leadIn} ${bullets}`.trim(), SUMMARY_MIN, 600);

    const headline = clip(`${school} · ${programName}`, 8, 80);

    return RecommendationNarrativeSchema.parse({
        program_id: score.program_id,
        university_id: score.university_id,
        locale,
        headline,
        summary,
        pros,
        cons: [],
    });
}

function clip(text: string, min: number, max: number): string {
    if (text.length > max) return text.slice(0, max - 1).trimEnd() + "…";
    if (text.length < min) return text.padEnd(min, " ").trim().padEnd(min, ".");
    return text;
}
