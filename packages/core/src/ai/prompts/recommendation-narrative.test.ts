import { describe, expect, it } from "vitest";
import {
    RecommendationNarrativeSchema,
    buildUserPrompt,
} from "./recommendation-narrative.js";

describe("RecommendationNarrativeSchema", () => {
    it("accepts a well-formed narrative", () => {
        const parsed = RecommendationNarrativeSchema.safeParse({
            program_id: "unsw-master-of-it",
            university_id: "unsw",
            locale: "zh",
            headline: "Strong applied IT fit",
            summary: "x".repeat(120),
            pros: [
                { text: "Applied teaching style match.", source_id: "rule:personality" },
                { text: "Tuition within budget.", source_id: "rule:budget" },
            ],
            cons: [],
        });
        expect(parsed.success).toBe(true);
    });

    it("rejects fewer than 2 pros", () => {
        const parsed = RecommendationNarrativeSchema.safeParse({
            program_id: "unsw-master-of-it",
            university_id: "unsw",
            locale: "zh",
            headline: "Strong fit",
            summary: "x".repeat(120),
            pros: [{ text: "Only one.", source_id: "rule:personality" }],
            cons: [],
        });
        expect(parsed.success).toBe(false);
    });

    it("rejects an unsupported locale", () => {
        const parsed = RecommendationNarrativeSchema.safeParse({
            program_id: "unsw-master-of-it",
            university_id: "unsw",
            locale: "fr",
            headline: "Strong fit",
            summary: "x".repeat(120),
            pros: [
                { text: "One.", source_id: "a" },
                { text: "Two.", source_id: "b" },
            ],
            cons: [],
        });
        expect(parsed.success).toBe(false);
    });
});

describe("buildUserPrompt", () => {
    it("includes locale, ids, and numbered reasons with source citations", () => {
        const out = buildUserPrompt({
            locale: "zh",
            program_id: "unsw-master-of-it",
            university_id: "unsw",
            program_name: "Master of IT",
            university_name: "UNSW",
            band: "match",
            final_score: 72.5,
            reasons: [
                { text: "Applied style matches.", source_id: "rule:personality" },
                { text: "Tuition within budget.", source_id: "rule:budget" },
            ],
        });
        expect(out).toContain("locale: zh");
        expect(out).toContain("program_id: unsw-master-of-it");
        expect(out).toContain("[source_id=rule:personality]");
        expect(out).toContain("final_score: 72.5");
    });
});
