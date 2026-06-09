import { describe, expect, it } from "vitest";
import { auditDataset } from "./audit";
import { loadAllProduction } from "./validate";

describe("dataset audit", () => {
    it("tracks source quality and tag pollution for later cleanup", () => {
        const { universities, programs } = loadAllProduction();
        const report = auditDataset(universities, programs);

        expect(report.programs.genericSourcePrograms).toBe(0);
        expect(report.programs.masterWithSteppingStone).toBe(0);
        expect(Object.keys(report.programs.genericSourceProgramsByCountry).length).toBe(0);
        expect(Object.keys(report.programs.masterWithSteppingStoneByCountry).length).toBe(0);
    });
});
