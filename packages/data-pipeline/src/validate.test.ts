import { describe, expect, it } from "vitest";
import { listProductionShards, verifyProduction } from "./validate";

describe("production validation", () => {
    it("discovers every paired country shard instead of only AU/UK/CA", () => {
        const shards = listProductionShards();

        expect(shards).toContain("au");
        expect(shards).toContain("uk");
        expect(shards).toContain("ca");
        expect(shards).toContain("us");
        expect(shards.length).toBeGreaterThan(3);
    });

    it("verifies the full production dataset", () => {
        const result = verifyProduction();

        expect(result.ok).toBe(true);
        expect(result.stats.universities).toBeGreaterThan(70);
        expect(result.stats.programs).toBeGreaterThan(190);
    });
});
