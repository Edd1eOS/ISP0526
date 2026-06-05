// Recommendation-engine simulation harness.
//
// Drives recommend() with a corpus of randomly generated, schema-valid student
// profiles, captures every school the engine returns, aggregates the results,
// and writes a machine-readable summary plus a human report to ./results/.
//
// It doubles as a property test: a fixed seed makes the corpus reproducible and
// the assertions below encode the engine's hard invariants (most importantly:
// an elite / highly-selective program must never surface in the safety band).
//
// Run just this file:   pnpm --filter @isp0526/core sim
// Tune the corpus:      SIM_RUNS=1000 SIM_SEED=42 pnpm --filter @isp0526/core sim

import { describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getCandidates } from "../src/data/index";
import { recommend } from "../src/rules/recommend";
import type {
    BandTier,
    Candidate,
    Score,
    SelectivityTier,
} from "../src/schemas/index";
import { mulberry32, randomProfile } from "./random-profile";

const HERE = dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = join(HERE, "results");

const RUNS = Number.parseInt(process.env.SIM_RUNS ?? "300", 10);
const SEED = Number.parseInt(process.env.SIM_SEED ?? "12648430", 10);

type Tier = SelectivityTier | "unknown";

type SchoolStat = {
    program_id: string;
    university: string;
    country: string;
    selectivity: Tier;
    appearances: number;
    bands: Record<BandTier, number>;
    score_sum: number;
};

type Violation = {
    run: number;
    program_id: string;
    university: string;
    selectivity: Tier;
    band: BandTier;
};

const BANDS: readonly BandTier[] = ["stretch", "match", "safety"];

function bandsOf(set: {
    stretch: readonly Score[];
    match: readonly Score[];
    safety: readonly Score[];
}): Array<{ score: Score; band: BandTier }> {
    return [
        ...set.stretch.map((score) => ({ score, band: "stretch" as const })),
        ...set.match.map((score) => ({ score, band: "match" as const })),
        ...set.safety.map((score) => ({ score, band: "safety" as const })),
    ];
}

type Summary = {
    generated_at: string;
    seed: number;
    runs: number;
    catalogue_size: number;
    band_totals: Record<BandTier, number>;
    selectivity_totals: Record<string, number>;
    country_totals: Record<string, number>;
    avg_recommendations_per_run: number;
    empty_run_rate: number;
    sparse_run_rate: number;
    elite_safety_violations: number;
    reason_violations: number;
    cap_violations: number;
    distinct_schools_recommended: number;
    schools: Array<{
        program_id: string;
        university: string;
        country: string;
        selectivity: Tier;
        appearances: number;
        share: number;
        bands: Record<BandTier, number>;
        avg_score: number;
    }>;
    violations: Violation[];
};

function runSimulation(candidates: readonly Candidate[]): Summary {
    const index = new Map(candidates.map((c) => [c.program.id, c] as const));
    const rng = mulberry32(SEED);

    const schools = new Map<string, SchoolStat>();
    const bandTotals: Record<BandTier, number> = {
        stretch: 0,
        match: 0,
        safety: 0,
    };
    const selectivityTotals: Record<string, number> = {};
    const countryTotals: Record<string, number> = {};
    const violations: Violation[] = [];

    let sparseRuns = 0;
    let emptyRuns = 0;
    let totalRecommended = 0;
    let reasonViolations = 0;
    let capViolations = 0;

    for (let run = 0; run < RUNS; run++) {
        const profile = randomProfile(rng);
        const { set, coverage } = recommend(profile, candidates);
        if (coverage.sparse) sparseRuns++;

        if (
            set.stretch.length > 5 ||
            set.match.length > 10 ||
            set.safety.length > 5
        ) {
            capViolations++;
        }

        const entries = bandsOf(set);
        if (entries.length === 0) emptyRuns++;
        totalRecommended += entries.length;

        for (const { score, band } of entries) {
            if (
                score.reasons.length < 3 ||
                score.reasons.some((r) => r.sources.length < 1)
            ) {
                reasonViolations++;
            }
            const cand = index.get(score.program_id);
            const selectivity: Tier =
                cand?.program.admission_profile?.selectivity ?? "unknown";
            const country = cand?.university.country ?? "??";
            const university = cand?.university.name_en ?? score.program_id;

            bandTotals[band]++;
            selectivityTotals[selectivity] =
                (selectivityTotals[selectivity] ?? 0) + 1;
            countryTotals[country] = (countryTotals[country] ?? 0) + 1;

            let stat = schools.get(score.program_id);
            if (!stat) {
                stat = {
                    program_id: score.program_id,
                    university,
                    country,
                    selectivity,
                    appearances: 0,
                    bands: { stretch: 0, match: 0, safety: 0 },
                    score_sum: 0,
                };
                schools.set(score.program_id, stat);
            }
            stat.appearances++;
            stat.bands[band]++;
            stat.score_sum += score.final_score;

            if (
                band === "safety" &&
                (selectivity === "elite" || selectivity === "highly_selective")
            ) {
                violations.push({
                    run,
                    program_id: score.program_id,
                    university,
                    selectivity,
                    band,
                });
            }
        }
    }

    const ranked = [...schools.values()].sort(
        (a, b) => b.appearances - a.appearances,
    );

    return {
        generated_at: new Date().toISOString(),
        seed: SEED,
        runs: RUNS,
        catalogue_size: candidates.length,
        band_totals: bandTotals,
        selectivity_totals: selectivityTotals,
        country_totals: countryTotals,
        avg_recommendations_per_run: round(totalRecommended / RUNS, 2),
        empty_run_rate: round(emptyRuns / RUNS, 3),
        sparse_run_rate: round(sparseRuns / RUNS, 3),
        elite_safety_violations: violations.length,
        reason_violations: reasonViolations,
        cap_violations: capViolations,
        distinct_schools_recommended: schools.size,
        schools: ranked.map((s) => ({
            program_id: s.program_id,
            university: s.university,
            country: s.country,
            selectivity: s.selectivity,
            appearances: s.appearances,
            share: round(s.appearances / RUNS, 3),
            bands: s.bands,
            avg_score: round(s.score_sum / s.appearances, 1),
        })),
        violations,
    };
}

function round(n: number, places: number): number {
    const f = 10 ** places;
    return Math.round(n * f) / f;
}

function sortedEntries(record: Record<string, number>): Array<[string, number]> {
    return Object.entries(record).sort((a, b) => b[1] - a[1]);
}

function renderReport(summary: Summary): string {
    const lines: string[] = [];
    lines.push("# Recommendation Engine Simulation Report");
    lines.push("");
    lines.push(`- Generated: ${summary.generated_at}`);
    lines.push(`- Seed: \`${summary.seed}\` (deterministic, reproducible)`);
    lines.push(`- Random profiles run: ${summary.runs}`);
    lines.push(`- Catalogue size: ${summary.catalogue_size} programs`);
    lines.push(
        `- Avg recommendations / run: ${summary.avg_recommendations_per_run}`,
    );
    lines.push(
        `- Empty-result runs: ${(summary.empty_run_rate * 100).toFixed(1)}%`,
    );
    lines.push(
        `- Sparse-coverage runs: ${(summary.sparse_run_rate * 100).toFixed(1)}%`,
    );
    lines.push(
        `- Distinct schools recommended: ${summary.distinct_schools_recommended}`,
    );
    lines.push(
        `- Reason-integrity violations: ${summary.reason_violations} (want 0)`,
    );
    lines.push(`- Band-cap violations: ${summary.cap_violations} (want 0)`);
    lines.push("");

    lines.push("## Invariant: elite / highly-selective never in safety");
    lines.push("");
    if (summary.elite_safety_violations === 0) {
        lines.push(
            "PASS - no elite or highly-selective program was ever placed in the safety band.",
        );
    } else {
        lines.push(
            `FAIL - ${summary.elite_safety_violations} violation(s) detected:`,
        );
        lines.push("");
        lines.push("| Run | Program | University | Selectivity |");
        lines.push("| --- | --- | --- | --- |");
        for (const v of summary.violations.slice(0, 50)) {
            lines.push(
                `| ${v.run} | ${v.program_id} | ${v.university} | ${v.selectivity} |`,
            );
        }
    }
    lines.push("");

    lines.push("## Band distribution");
    lines.push("");
    lines.push("| Band | Count | Share |");
    lines.push("| --- | --- | --- |");
    const bandSum =
        summary.band_totals.stretch +
        summary.band_totals.match +
        summary.band_totals.safety || 1;
    for (const band of BANDS) {
        const count = summary.band_totals[band];
        lines.push(
            `| ${band} | ${count} | ${((count / bandSum) * 100).toFixed(1)}% |`,
        );
    }
    lines.push("");

    lines.push("## Selectivity mix of recommended schools");
    lines.push("");
    lines.push("| Selectivity | Count |");
    lines.push("| --- | --- |");
    for (const [tier, count] of sortedEntries(summary.selectivity_totals)) {
        lines.push(`| ${tier} | ${count} |`);
    }
    lines.push("");

    lines.push("## Country distribution");
    lines.push("");
    lines.push("| Country | Count |");
    lines.push("| --- | --- |");
    for (const [country, count] of sortedEntries(summary.country_totals)) {
        lines.push(`| ${country} | ${count} |`);
    }
    lines.push("");

    lines.push("## Top 25 most-recommended schools");
    lines.push("");
    lines.push(
        "| Program | University | Country | Selectivity | Appearances | Share | Stretch/Match/Safety | Avg score |",
    );
    lines.push("| --- | --- | --- | --- | --- | --- | --- | --- |");
    for (const s of summary.schools.slice(0, 25)) {
        lines.push(
            `| ${s.program_id} | ${s.university} | ${s.country} | ${s.selectivity} | ${s.appearances} | ${(s.share * 100).toFixed(1)}% | ${s.bands.stretch}/${s.bands.match}/${s.bands.safety} | ${s.avg_score} |`,
        );
    }
    lines.push("");

    return lines.join("\n");
}

describe("recommendation engine simulation", () => {
    const candidates = getCandidates();
    const summary = runSimulation(candidates);

    it(`captures and stores school data over ${RUNS} random runs`, () => {
        mkdirSync(RESULTS_DIR, { recursive: true });
        writeFileSync(
            join(RESULTS_DIR, "summary.json"),
            `${JSON.stringify(summary, null, 2)}\n`,
            "utf8",
        );
        writeFileSync(
            join(RESULTS_DIR, "report.md"),
            `${renderReport(summary)}\n`,
            "utf8",
        );

        expect(summary.distinct_schools_recommended).toBeGreaterThan(0);
        expect(summary.runs).toBe(RUNS);
    });

    it("never places an elite or highly-selective program in safety", () => {
        expect(summary.violations).toEqual([]);
        expect(summary.elite_safety_violations).toBe(0);
    });

    it("produces a usable set for the large majority of profiles", () => {
        expect(summary.empty_run_rate).toBeLessThan(0.5);
    });

    it("every recommended school carries >= 3 cited reasons", () => {
        expect(summary.reason_violations).toBe(0);
    });

    it("respects per-band caps on every run", () => {
        expect(summary.cap_violations).toBe(0);
    });
});
