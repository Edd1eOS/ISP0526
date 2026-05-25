import { describe, expect, it } from "vitest";
import { generateReportChatReply } from "./report-chat";
import type { GenerateObjectFn } from "./narrative";

const baseInput = {
    locale: "zh" as const,
    question: "学费大概多少？",
    programs: [
        {
            program_id: "unimelb-mc-it" as const,
            university_id: "unimelb" as const,
            band: "match" as const,
            final_score: 78,
            country: "AU",
            city: "Melbourne",
            program_name: "Master of IT",
            university_name: "University of Melbourne",
            tuition_annual_aud: 50000,
            tags: ["career_pipeline"],
            source_ids: ["unimelb_handbook_2026"],
        },
    ],
    visas: [
        {
            country: "AU",
            visa_class: "Subclass 500",
            total_weeks_typical: 12,
            post_study_work_years: 2,
            source_id: "homeaffairs_500_2026",
        },
    ],
    history: [],
};

const allowed = new Set(["unimelb_handbook_2026", "homeaffairs_500_2026"]);

describe("generateReportChatReply", () => {
    it("returns the parsed reply when generation succeeds", async () => {
        const generate: GenerateObjectFn = async () => ({
            object: {
                locale: "zh",
                reply: "你关心的项目年学费约 50,000 澳币。",
                citations: [
                    { source_id: "unimelb_handbook_2026", note: "annual tuition" },
                ],
                followups: ["生活费如何？"],
            },
        });
        const result = await generateReportChatReply({
            ...baseInput,
            knownSourceIds: allowed,
            generate,
        });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.citations.length).toBe(1);
            expect(result.value.followups[0]).toContain("生活费");
        }
    });

    it("drops citations that reference unknown source_ids", async () => {
        const generate: GenerateObjectFn = async () => ({
            object: {
                locale: "zh",
                reply: "学费区间见报告，签证流程见官网。",
                citations: [
                    { source_id: "unimelb_handbook_2026", note: "real" },
                    { source_id: "fabricated_2030", note: "made up" },
                ],
                followups: [],
            },
        });
        const result = await generateReportChatReply({
            ...baseInput,
            knownSourceIds: allowed,
            generate,
        });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.citations.map((c) => c.source_id)).toEqual([
                "unimelb_handbook_2026",
            ]);
        }
    });

    it("returns validation_failed when the model returns malformed JSON", async () => {
        const generate: GenerateObjectFn = async () => ({
            object: { reply: "" },
        });
        const result = await generateReportChatReply({
            ...baseInput,
            knownSourceIds: allowed,
            generate,
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.kind).toBe("validation_failed");
        }
    });

    it("returns generation_failed when the model throws", async () => {
        const generate: GenerateObjectFn = async () => {
            throw new Error("network down");
        };
        const result = await generateReportChatReply({
            ...baseInput,
            knownSourceIds: allowed,
            generate,
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.kind).toBe("generation_failed");
        }
    });
});
