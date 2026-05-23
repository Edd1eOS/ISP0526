import { describe, expect, it, vi } from "vitest";

import {
    DEFAULT_CONFIDENCE_FLOOR,
    extractProfileFromText,
} from "./intake-extraction";

const stubGenerate = (object: unknown) => vi.fn(async () => ({ object }));

describe("extractProfileFromText", () => {
    it("returns validation_failed on empty input", async () => {
        const result = await extractProfileFromText({
            locale: "en",
            text: "  \n  ",
            generate: stubGenerate({}),
        });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.kind).toBe("validation_failed");
    });

    it("parses and returns confident fields", async () => {
        const result = await extractProfileFromText({
            locale: "en",
            text: "GPA 3.7, IELTS 7.0, target Computer Science",
            generate: stubGenerate({
                academic: {
                    gpa: {
                        value: 3.7,
                        confidence: 0.95,
                        source_excerpt: "GPA 3.7",
                    },
                    ielts_overall: {
                        value: 7,
                        confidence: 0.9,
                        source_excerpt: "IELTS 7.0",
                    },
                    target_field: {
                        value: "Computer Science",
                        confidence: 0.8,
                        source_excerpt: "target Computer Science",
                    },
                },
                budget: {},
            }),
        });
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.value.academic.gpa?.value).toBe(3.7);
        expect(result.value.academic.ielts_overall?.value).toBe(7);
        expect(result.value.academic.target_field?.value).toBe("Computer Science");
    });

    it("drops fields below confidence floor", async () => {
        const result = await extractProfileFromText({
            locale: "en",
            text: "may be a phd candidate",
            generate: stubGenerate({
                academic: {
                    target_level: {
                        value: "phd",
                        confidence: 0.2,
                        source_excerpt: "may be a phd candidate",
                    },
                },
                budget: {},
            }),
        });
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.value.academic.target_level).toBeUndefined();
    });

    it("respects custom confidence floor", async () => {
        const result = await extractProfileFromText({
            locale: "en",
            text: "phd",
            confidenceFloor: 0.1,
            generate: stubGenerate({
                academic: {
                    target_level: {
                        value: "phd",
                        confidence: 0.2,
                        source_excerpt: "phd",
                    },
                },
                budget: {},
            }),
        });
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.value.academic.target_level?.value).toBe("phd");
    });

    it("flags schema-invalid output", async () => {
        const result = await extractProfileFromText({
            locale: "en",
            text: "anything",
            generate: stubGenerate({
                academic: {
                    gpa: {
                        // out of range
                        value: 5.5,
                        confidence: 0.9,
                        source_excerpt: "GPA 5.5",
                    },
                },
                budget: {},
            }),
        });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.kind).toBe("validation_failed");
    });

    it("surfaces generation errors", async () => {
        const result = await extractProfileFromText({
            locale: "en",
            text: "anything",
            generate: vi.fn(async () => {
                throw new Error("rate limited");
            }),
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.kind).toBe("generation_failed");
            expect(result.error.message).toBe("rate limited");
        }
    });

    it("exports a sane default floor", () => {
        expect(DEFAULT_CONFIDENCE_FLOOR).toBeGreaterThan(0);
        expect(DEFAULT_CONFIDENCE_FLOOR).toBeLessThan(1);
    });
});
