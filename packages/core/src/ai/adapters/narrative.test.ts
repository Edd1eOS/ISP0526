import { describe, expect, it } from "vitest";
import { generateRecommendationNarrative } from "./narrative.js";
import { scoreCandidate } from "../../rules/score.js";
import {
    buildProfile,
    fixtureCandidate,
} from "../../rules/dimensions/__fixtures__.js";
import type { GenerateObjectFn } from "./narrative.js";

function fakeGenerator(object: unknown): GenerateObjectFn {
    return async () => ({ object });
}

describe("generateRecommendationNarrative", () => {
    const score = scoreCandidate(
        buildProfile({ academic: { gpa: 3.4, ielts_overall: 7 } }),
        fixtureCandidate,
    );

    it("returns Ok and runs the post-filter when output is well-formed", async () => {
        const knownId = score.reasons[0]!.sources[0]!.source_id;
        const generate = fakeGenerator({
            program_id: score.program_id,
            university_id: score.university_id,
            locale: "zh",
            headline: "Strong applied IT fit at UNSW",
            summary:
                "This program aligns with your applied-learning preference and your stated budget for the year.",
            pros: [
                { text: "Applied teaching style match.", source_id: knownId },
                { text: "Tuition fits within budget.", source_id: knownId },
            ],
            cons: [],
        });
        const r = await generateRecommendationNarrative({
            score,
            candidate: fixtureCandidate,
            locale: "zh",
            generate,
        });
        expect(r.ok).toBe(true);
    });

    it("returns Err(validation_failed) when the LLM returns malformed JSON", async () => {
        const generate = fakeGenerator({ wrong: "shape" });
        const r = await generateRecommendationNarrative({
            score,
            candidate: fixtureCandidate,
            locale: "zh",
            generate,
        });
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.error.kind).toBe("validation_failed");
    });

    it("returns Err(generation_failed) when the generator throws", async () => {
        const generate: GenerateObjectFn = async () => {
            throw new Error("boom");
        };
        const r = await generateRecommendationNarrative({
            score,
            candidate: fixtureCandidate,
            locale: "zh",
            generate,
        });
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.error.kind).toBe("generation_failed");
    });

    it("rejects when the model fabricates a source_id", async () => {
        const generate = fakeGenerator({
            program_id: score.program_id,
            university_id: score.university_id,
            locale: "zh",
            headline: "Fabricated narrative",
            summary:
                "This summary cites two fabricated sources that do not exist in the catalog.",
            pros: [
                { text: "Hallucination 1.", source_id: "ghost-a" },
                { text: "Hallucination 2.", source_id: "ghost-b" },
            ],
            cons: [],
        });
        const r = await generateRecommendationNarrative({
            score,
            candidate: fixtureCandidate,
            locale: "zh",
            generate,
        });
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.error.kind).toBe("post_filter_rejected");
    });
});
