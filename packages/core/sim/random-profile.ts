// Deterministic random StudentProfile generator for engine simulation.
//
// Uses a seeded PRNG (mulberry32) so every run with the same seed produces the
// same sequence of profiles. This keeps the simulation reproducible: a seed is
// recorded in the result report, and re-running it reproduces identical school
// data for debugging a regression.

import {
    StudentProfileSchema,
    type Country,
    type ProgramTag,
    type StudentProfile,
    type StudyLevel,
} from "../src/schemas/index";

/** mulberry32: tiny, fast, seedable PRNG returning a float in [0, 1). */
export function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return function next(): number {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

type Rng = () => number;

const pick = <T>(rng: Rng, arr: readonly T[]): T =>
    arr[Math.floor(rng() * arr.length)] as T;

const chance = (rng: Rng, p: number): boolean => rng() < p;

const between = (rng: Rng, lo: number, hi: number): number =>
    lo + rng() * (hi - lo);

const intBetween = (rng: Rng, lo: number, hi: number): number =>
    Math.floor(between(rng, lo, hi + 1));

const round = (n: number, places: number): number => {
    const f = 10 ** places;
    return Math.round(n * f) / f;
};

/** Sample `count` distinct elements from `arr` (count capped at arr.length). */
function sample<T>(rng: Rng, arr: readonly T[], count: number): T[] {
    const pool = [...arr];
    const out: T[] = [];
    const take = Math.min(count, pool.length);
    for (let i = 0; i < take; i++) {
        const idx = Math.floor(rng() * pool.length);
        out.push(pool[idx] as T);
        pool.splice(idx, 1);
    }
    return out;
}

// Fields biased toward what the seed catalogue actually offers so most runs
// produce a meaningful candidate pool rather than empty sets.
const FIELDS: readonly string[] = [
    "Computer Science",
    "Data Science",
    "Information Technology",
    "Software Engineering",
    "Artificial Intelligence",
    "Finance",
    "Business Analytics",
    "Business Administration",
    "Business",
    "Electrical Engineering",
    "Civil Engineering",
    "Statistics",
    "Public Policy",
    "Public Health",
    "Design",
    "Architecture",
];

const COUNTRIES: readonly Country[] = [
    "AU",
    "US",
    "UK",
    "CA",
    "NZ",
    "HK",
    "SG",
    "MY",
    "DE",
    "NL",
    "IE",
    "TW",
];

const TAGS: readonly ProgramTag[] = [
    "field_top",
    "value_for_money",
    "stepping_stone",
    "migration_friendly",
    "tuition_friendly",
    "scholarship_rich",
    "chinese_community",
    "career_pipeline",
];

const CITY_SIZES = ["mega", "large", "medium", "small"] as const;
const CLIMATES = ["tropical", "subtropical", "temperate", "cold"] as const;

function randomLevel(rng: Rng): StudyLevel {
    const r = rng();
    if (r < 0.8) return "master";
    if (r < 0.92) return "bachelor";
    if (r < 0.97) return "phd";
    return "foundation";
}

/**
 * Build one random, schema-valid StudentProfile. Every optional signal is
 * included probabilistically so the corpus spans the full input surface:
 * strong vs weak GPA, IELTS vs TOEFL vs no language score, with/without
 * country preference, budget, tags, lifestyle and career hints.
 */
export function randomProfile(rng: Rng): StudentProfile {
    const academic: Record<string, unknown> = {
        target_level: randomLevel(rng),
    };

    // GPA present 95% of the time, spanning weak (2.3) to perfect (4.0).
    if (chance(rng, 0.95)) {
        academic["gpa"] = round(between(rng, 2.3, 4.0), 2);
    }

    // Language: IELTS (55%), TOEFL (35%), or none (10%).
    const lang = rng();
    if (lang < 0.55) {
        // IELTS rounded to nearest 0.5 between 5.5 and 8.0.
        academic["ielts_overall"] = round(between(rng, 5.5, 8.0) * 2, 0) / 2;
    } else if (lang < 0.9) {
        academic["toefl_total"] = intBetween(rng, 70, 118);
    }

    if (chance(rng, 0.9)) {
        academic["target_field"] = pick(rng, FIELDS);
    }

    const budget: Record<string, unknown> = {
        flex: pick(rng, [0, 0.05, 0.1, 0.15, 0.2]),
    };
    if (chance(rng, 0.85)) {
        budget["annual_aud"] = intBetween(rng, 30_000, 180_000);
    }

    const hard_constraints: Record<string, unknown> = {
        excluded_countries: [],
        required_tags: [],
    };
    // Half the corpus expresses a country preference (1-2 countries).
    if (chance(rng, 0.5)) {
        hard_constraints["preferred_countries"] = sample(
            rng,
            COUNTRIES,
            intBetween(rng, 1, 2),
        );
    }

    const preferred_tags = chance(rng, 0.6)
        ? sample(rng, TAGS, intBetween(rng, 1, 3))
        : [];

    const lifestyle: Record<string, unknown> = {};
    if (chance(rng, 0.4)) lifestyle["city_size"] = pick(rng, CITY_SIZES);
    if (chance(rng, 0.4)) lifestyle["climate"] = pick(rng, CLIMATES);

    const career: Record<string, unknown> = {};
    if (chance(rng, 0.5)) career["internship_importance"] = intBetween(rng, 1, 5);
    if (chance(rng, 0.5)) career["migration_intent"] = intBetween(rng, 1, 5);

    const input: Record<string, unknown> = {
        academic,
        budget,
        hard_constraints,
        preferred_tags,
        lifestyle,
        career,
    };

    if (chance(rng, 0.3)) {
        input["big_five"] = {
            openness: round(between(rng, 0, 7), 1),
            conscientiousness: round(between(rng, 0, 7), 1),
            extraversion: round(between(rng, 0, 7), 1),
            agreeableness: round(between(rng, 0, 7), 1),
            neuroticism: round(between(rng, 0, 7), 1),
        };
    }

    return StudentProfileSchema.parse(input);
}
