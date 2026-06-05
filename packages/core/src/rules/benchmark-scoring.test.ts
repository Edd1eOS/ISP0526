import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { getCandidates } from "../data/index";
import { buildProfile } from "./dimensions/__fixtures__";
import { recommend } from "./recommend";

const FIELDS = [
    "Information Technology",
    "Computer Science",
    "Data Science",
    "Business",
    "Finance",
    "Engineering",
    "Design",
    "Education",
] as const;

const CITY_SIZES = ["mega", "large", "medium", "small"] as const;
const TEACHING = ["theory_heavy", "balanced", "applied_heavy"] as const;

function seededRandom(seed: number) {
    let s = seed;
    return () => {
        s = (s * 1664525 + 1013904223) % 4294967296;
        return s / 4294967296;
    };
}

function likert(rand: () => number) {
    return Math.floor(rand() * 5) + 1;
}

function sampleProfiles(n: number) {
    const rand = seededRandom(42);
    return Array.from({ length: n }, () =>
        buildProfile({
            academic: {
                target_level: "master",
                target_field: FIELDS[Math.floor(rand() * FIELDS.length)],
                gpa: Math.round((2.5 + rand() * 1.5) * 100) / 100,
                ielts_overall: Math.round((6 + rand() * 2) * 10) / 10,
            },
            learning: {
                teaching_style: TEACHING[Math.floor(rand() * TEACHING.length)],
                prefers_applied: likert(rand),
            },
            career: {
                migration_intent: likert(rand),
                internship_importance: likert(rand),
                salary_sensitivity: likert(rand),
            },
            budget: {
                annual_aud: Math.round(40000 + rand() * 80000),
                flex: Math.round(rand() * 30) / 100,
            },
            lifestyle: {
                city_size: CITY_SIZES[Math.floor(rand() * CITY_SIZES.length)],
            },
            big_five: {
                openness: Math.floor(rand() * 8),
                conscientiousness: Math.floor(rand() * 8),
                extraversion: Math.floor(rand() * 8),
                agreeableness: Math.floor(rand() * 8),
                neuroticism: Math.floor(rand() * 8),
            },
            preferred_tags: rand() > 0.5 ? ["field_top"] : [],
        }),
    );
}

function stats(values: number[]) {
    const sorted = [...values].sort((a, b) => a - b);
    const n = values.length;
    const mean = values.reduce((a, b) => a + b, 0) / n;
    const variance = values.reduce((a, b) => a + b ** 2, 0) / n - mean ** 2;
    const stdDev = Math.sqrt(Math.max(0, variance));
    const q1 = sorted[Math.floor(n * 0.25)];
    const q3 = sorted[Math.floor(n * 0.75)];
    return {
        mean,
        median: sorted[Math.floor(n / 2)],
        stdDev,
        min: sorted[0],
        max: sorted[n - 1],
        q1,
        q3,
        iqr: q3 - q1,
    };
}

function skewness(values: number[], mean: number, stdDev: number) {
    if (stdDev === 0) return 0;
    return values.reduce((acc, x) => acc + ((x - mean) / stdDev) ** 3, 0) / values.length;
}

function histogram(values: number[], bins: number) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const width = (max - min) / bins || 1;
    return Array.from({ length: bins }, (_, i) => {
        const start = min + i * width;
        const end = start + width;
        const count = values.filter((x) => x >= start && (i === bins - 1 ? x <= end : x < end)).length;
        return {
            range: `${start.toFixed(0)}-${end.toFixed(0)}`,
            count,
            percentage: ((count / values.length) * 100).toFixed(1),
        };
    });
}

export function runScoringBenchmark(runs = 300) {
    const candidates = getCandidates();
    const profiles = sampleProfiles(runs);
    const topScores: number[] = [];
    const breakdowns: Record<string, number[]> = {};
    const categories = { excellent: 0, good: 0, fair: 0, poor: 0, veryPoor: 0 };

    for (const profile of profiles) {
        const { set } = recommend(profile, candidates);
        const all = [...set.stretch, ...set.match, ...set.safety];
        const top = all.sort((a, b) => b.final_score - a.final_score)[0];
        if (!top) continue;
        topScores.push(top.final_score);
        if (top.final_score >= 85) categories.excellent++;
        else if (top.final_score >= 70) categories.good++;
        else if (top.final_score >= 50) categories.fair++;
        else if (top.final_score >= 30) categories.poor++;
        else categories.veryPoor++;
        for (const [k, v] of Object.entries(top.breakdown)) {
            (breakdowns[k] ??= []).push(v * 100);
        }
    }

    const scoreStats = stats(topScores);
    const dimStats: Record<string, { mean: string; variance: string; stdDev: string }> = {};
    for (const [dim, vals] of Object.entries(breakdowns)) {
        const ds = stats(vals);
        dimStats[dim] = {
            mean: ds.mean.toFixed(2),
            variance: (ds.stdDev ** 2).toFixed(2),
            stdDev: ds.stdDev.toFixed(2),
        };
    }

    return {
        metadata: {
            timestamp: new Date().toISOString(),
            runs,
            testType: "real_recommendation_engine",
            candidates: candidates.length,
            universities: new Set(candidates.map((c) => c.university.id)).size,
        },
        score_distribution: {
            mean: scoreStats.mean.toFixed(2),
            median: scoreStats.median.toFixed(2),
            stdDev: scoreStats.stdDev.toFixed(2),
            min: scoreStats.min.toFixed(2),
            max: scoreStats.max.toFixed(2),
            q1: scoreStats.q1.toFixed(2),
            q3: scoreStats.q3.toFixed(2),
            iqr: scoreStats.iqr.toFixed(2),
            skewness: skewness(topScores, scoreStats.mean, scoreStats.stdDev).toFixed(4),
            coefficientOfVariation: ((scoreStats.stdDev / scoreStats.mean) * 100).toFixed(2),
        },
        categories,
        dimension_analysis: dimStats,
        histogram_bins: histogram(topScores, 10),
        note: "Uses real scoreCandidate/recommend against packages/core/data (11 universities, 75 programs).",
    };
}

describe("scoring distribution benchmark", () => {
    it(`runs ${300} profiles against real engine and writes report`, () => {
        const report = runScoringBenchmark(300);

        const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
        const outPath = path.join(root, "test-300-statistical-report.json");
        fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

        console.log("\n=== REAL ENGINE BENCHMARK ===");
        console.log(`data: ${report.metadata.universities} universities, ${report.metadata.candidates} programs`);
        console.log(`mean=${report.score_distribution.mean} median=${report.score_distribution.median} std=${report.score_distribution.stdDev}`);
        console.log(`min=${report.score_distribution.min} max=${report.score_distribution.max}`);
        console.log(`85+: ${report.categories.excellent}  70-84: ${report.categories.good}`);
        console.log(`report: ${outPath}`);

        expect(Number(report.score_distribution.mean)).toBeGreaterThanOrEqual(55);
        expect(Number(report.score_distribution.max)).toBeLessThanOrEqual(100);
    });
});
