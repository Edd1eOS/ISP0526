import { describe, expect, it } from "vitest";
import { generateBatchNarratives } from "./narrative-batch";
import { scoreCandidate } from "../../rules/score";
import {
    buildProfile,
    fixtureCandidate,
} from "../../rules/dimensions/__fixtures__";
import type { GenerateObjectFn } from "./narrative";

function fakeGenerator(object: unknown): GenerateObjectFn {
    return async () => ({ object });
}

describe("generateBatchNarratives", () => {
    const profile = buildProfile({ academic: { gpa: 3.4, ielts_overall: 7 } });
    const score = scoreCandidate(profile, fixtureCandidate);
    const items = [{ score, candidate: fixtureCandidate }];
    const knownId = score.reasons[0]!.sources[0]!.source_id;

    it("returns an empty result when given no items", async () => {
        const generate = fakeGenerator({ narratives: [] });
        const r = await generateBatchNarratives({
            locale: "zh",
            items: [],
            generate,
        });
        expect(r.ok).toBe(true);
        if (r.ok) {
            expect(r.value.narratives.size).toBe(0);
            expect(r.value.rejected.length).toBe(0);
        }
    });

    it("maps a well-formed batch by program_id", async () => {
        const generate = fakeGenerator({
            narratives: [
                {
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
                },
            ],
        });
        const r = await generateBatchNarratives({
            locale: "zh",
            items,
            generate,
        });
        expect(r.ok).toBe(true);
        if (r.ok) {
            expect(r.value.narratives.get(score.program_id)).toBeTruthy();
            expect(r.value.rejected.length).toBe(0);
        }
    });

    it("reports rejected items so the caller can fall back", async () => {
        const generate = fakeGenerator({
            narratives: [
                {
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
                },
            ],
        });
        const r = await generateBatchNarratives({
            locale: "zh",
            items,
            generate,
        });
        expect(r.ok).toBe(true);
        if (r.ok) {
            expect(r.value.narratives.size).toBe(0);
            expect(r.value.rejected.length).toBe(1);
            expect(r.value.rejected[0]!.program_id).toBe(score.program_id);
        }
    });

    it("returns Err(validation_failed) when the response shape is wrong", async () => {
        const generate = fakeGenerator({ wrong: "shape" });
        const r = await generateBatchNarratives({
            locale: "zh",
            items,
            generate,
        });
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.error.kind).toBe("validation_failed");
    });

    it("returns Err(generation_failed) when the generator throws", async () => {
        const generate: GenerateObjectFn = async () => {
            throw new Error("boom");
        };
        const r = await generateBatchNarratives({
            locale: "zh",
            items,
            generate,
        });
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.error.kind).toBe("generation_failed");
    });
});
