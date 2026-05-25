import { describe, expect, it } from "vitest";
import type { StudentProfile } from "../../schemas/index";
import {
    getEffectiveGpa4,
    normalizeCredential,
    summarizeCredentials,
} from "./academic-grade";

describe("normalizeCredential", () => {
    it("parses gaokao raw score against 750 default", () => {
        const n = normalizeCredential({ kind: "gaokao", raw: "680" });
        expect(n.value_0to1).toBeCloseTo(680 / 750, 4);
        expect(n.gpa_4).toBeCloseTo((680 / 750) * 4, 1);
        expect(n.confidence).toBeGreaterThan(0.5);
    });

    it("respects explicit gaokao max", () => {
        const n = normalizeCredential({ kind: "gaokao", raw: "680/900" });
        expect(n.value_0to1).toBeCloseTo(680 / 900, 4);
    });

    it("averages AP scores", () => {
        const n = normalizeCredential({ kind: "ap", raw: "5,5,5,4,4" });
        // avg 4.6 -> (4.6-1)/4 = 0.9
        expect(n.value_0to1).toBeCloseTo(0.9, 2);
        expect(n.confidence).toBe(1);
    });

    it("parses A-level grade strings including A*", () => {
        const n = normalizeCredential({ kind: "alevel", raw: "A*AB" });
        // (1 + 0.9 + 0.8) / 3 = 0.9
        expect(n.value_0to1).toBeCloseTo(0.9, 2);
    });

    it("maps Chinese UK class synonyms", () => {
        const n = normalizeCredential({ kind: "uk_class", raw: "二等一" });
        expect(n.value_0to1).toBeCloseTo(0.8, 2);
    });

    it("maps a WAM of 75 into upper band", () => {
        const n = normalizeCredential({ kind: "wam_100", raw: "75" });
        expect(n.value_0to1).toBeCloseTo(0.5 + (25 / 45) * 0.5, 3);
    });

    it("returns zero confidence for free-form certificate", () => {
        const n = normalizeCredential({
            kind: "certificate",
            raw: "CFA Level I passed",
        });
        expect(n.confidence).toBe(0);
        expect(n.value_0to1).toBeNull();
    });

    it("returns empty when raw has no number for numeric kinds", () => {
        const n = normalizeCredential({ kind: "gpa_4", raw: "no idea" });
        expect(n.value_0to1).toBeNull();
        expect(n.confidence).toBe(0);
    });
});

describe("summarizeCredentials", () => {
    it("picks the highest-confidence credential", () => {
        const summary = summarizeCredentials([
            { kind: "certificate", raw: "Some random certificate" },
            { kind: "gaokao", raw: "700" },
        ]);
        expect(summary?.kind).toBe("gaokao");
    });

    it("returns null when nothing is usable", () => {
        const summary = summarizeCredentials([
            { kind: "certificate", raw: "x" },
            { kind: "other", raw: "y" },
        ]);
        expect(summary).toBeNull();
    });
});

describe("getEffectiveGpa4", () => {
    const baseProfile: StudentProfile = {
        academic: {
            target_level: "master",
            credentials: [],
        },
        preferences: {
            preferred_tags: [],
            avoided_tags: [],
        },
        constraints: { hard: { required_tags: [] } },
        weights: {},
    } as unknown as StudentProfile;

    it("prefers the legacy explicit gpa field", () => {
        const p: StudentProfile = {
            ...baseProfile,
            academic: { ...baseProfile.academic, gpa: 3.5 },
        };
        expect(getEffectiveGpa4(p)).toBe(3.5);
    });

    it("falls back to credentials when gpa is unset", () => {
        const p: StudentProfile = {
            ...baseProfile,
            academic: {
                ...baseProfile.academic,
                credentials: [{ kind: "gaokao", raw: "750" }],
            },
        };
        expect(getEffectiveGpa4(p)).toBe(4);
    });

    it("returns undefined when nothing useful is provided", () => {
        expect(getEffectiveGpa4(baseProfile)).toBeUndefined();
    });
});
