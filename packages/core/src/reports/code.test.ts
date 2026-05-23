import { describe, expect, it } from "vitest";
import { generateReportCode } from "./code";

describe("generateReportCode", () => {
    it("returns a 6-char string from the Crockford-ish alphabet", () => {
        const code = generateReportCode();
        expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    });

    it("is deterministic given a deterministic rng", () => {
        const rng = sequence([0.1, 0.2, 0.3, 0.4, 0.5, 0.6]);
        expect(generateReportCode(rng)).toBe(generateReportCode(sequence([0.1, 0.2, 0.3, 0.4, 0.5, 0.6])));
    });
});

function sequence(values: number[]): () => number {
    let i = 0;
    return () => values[i++ % values.length]!;
}
