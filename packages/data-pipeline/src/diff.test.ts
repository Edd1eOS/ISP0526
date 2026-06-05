import { describe, expect, it } from "vitest";
import { diffPrograms, diffUniversities, summarizeDiff } from "./diff";

describe("diff", () => {
    it("detects add / change / same", () => {
        const prod = [{ id: "a", v: 1 }, { id: "b", v: 2 }];
        const draft = [{ id: "a", v: 1 }, { id: "b", v: 3 }, { id: "c", v: 4 }];
        const d = diffUniversities(prod, draft);
        const s = summarizeDiff(d);
        expect(s.add).toBe(1);
        expect(s.change).toBe(1);
        expect(s.same).toBe(1);
    });

    it("works for programs", () => {
        const d = diffPrograms([{ id: "p1" }], [{ id: "p1" }, { id: "p2" }]);
        expect(summarizeDiff(d).add).toBe(1);
    });
});
