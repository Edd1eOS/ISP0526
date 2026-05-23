import { describe, expect, it } from "vitest";
import { renderTemplateNarrative } from "./narrative-template";
import { RecommendationNarrativeSchema } from "../prompts/recommendation-narrative";
import { scoreCandidate } from "../../rules/score";
import {
    buildProfile,
    fixtureCandidate,
} from "../../rules/dimensions/__fixtures__";

describe("renderTemplateNarrative", () => {
    const score = scoreCandidate(
        buildProfile({ academic: { gpa: 3.4, ielts_overall: 7 } }),
        fixtureCandidate,
    );

    it("returns a narrative that validates against the schema", () => {
        const out = renderTemplateNarrative(score, fixtureCandidate, "zh");
        expect(RecommendationNarrativeSchema.safeParse(out).success).toBe(true);
    });

    it("respects the requested locale", () => {
        const en = renderTemplateNarrative(score, fixtureCandidate, "en");
        const zh = renderTemplateNarrative(score, fixtureCandidate, "zh");
        expect(en.locale).toBe("en");
        expect(zh.locale).toBe("zh");
        expect(en.headline).toContain(fixtureCandidate.university.name_en);
        expect(zh.headline).toContain(fixtureCandidate.university.name_zh);
    });

    it("caps pros at 5 entries and cites every entry", () => {
        const out = renderTemplateNarrative(score, fixtureCandidate, "zh");
        expect(out.pros.length).toBeLessThanOrEqual(5);
        for (const p of out.pros) expect(p.source_id.length).toBeGreaterThan(0);
    });
});
