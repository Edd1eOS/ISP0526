import { describe, expect, it } from "vitest";
import { filterNarrative } from "./post-filter.js";
import {
    RecommendationNarrativeSchema,
    type RecommendationNarrative,
} from "./prompts/recommendation-narrative.js";

function makeNarrative(
    overrides: Partial<{
        pros: RecommendationNarrative["pros"];
        cons: RecommendationNarrative["cons"];
    }> = {},
): RecommendationNarrative {
    return RecommendationNarrativeSchema.parse({
        program_id: "unsw-master-of-it",
        university_id: "unsw",
        locale: "zh",
        headline: "Strong applied IT fit at UNSW",
        summary:
            "This program lines up with your applied-style preference and tuition fits comfortably within your stated budget for the year.",
        pros: overrides.pros ?? [
            { text: "Applied teaching style matches preference.", source_id: "rule:personality" },
            { text: "Tuition fits within annual budget.", source_id: "rule:budget" },
        ],
        cons: overrides.cons ?? [],
    });
}

describe("filterNarrative", () => {
    it("passes through when all citations are known", () => {
        const known = new Set(["rule:personality", "rule:budget"]);
        const r = filterNarrative(makeNarrative(), known);
        expect(r.ok).toBe(true);
    });

    it("drops pros that cite unknown sources", () => {
        const narrative = makeNarrative({
            pros: [
                { text: "Match.", source_id: "rule:personality" },
                { text: "Hallucinated.", source_id: "rule:does_not_exist" },
                { text: "Budget ok.", source_id: "rule:budget" },
            ],
        });
        const known = new Set(["rule:personality", "rule:budget"]);
        const r = filterNarrative(narrative, known);
        expect(r.ok).toBe(true);
        if (r.ok) {
            expect(r.value.pros).toHaveLength(2);
            expect(r.value.pros.every((p) => known.has(p.source_id))).toBe(true);
        }
    });

    it("rejects when fewer than 2 verifiable pros remain", () => {
        const narrative = makeNarrative({
            pros: [
                { text: "Match.", source_id: "rule:personality" },
                { text: "Hallucinated.", source_id: "rule:does_not_exist" },
            ],
        });
        const known = new Set(["rule:personality"]);
        const r = filterNarrative(narrative, known);
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.error.kind).toBe("post_filter_rejected");
    });

    it("drops cons that cite unknown sources without rejecting", () => {
        const narrative = makeNarrative({
            cons: [{ text: "Made up.", source_id: "ghost" }],
        });
        const known = new Set(["rule:personality", "rule:budget"]);
        const r = filterNarrative(narrative, known);
        expect(r.ok).toBe(true);
        if (r.ok) expect(r.value.cons).toHaveLength(0);
    });
});
