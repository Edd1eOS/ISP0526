// Convert a raw AcademicCredential into a normalized 0..1 score (and an
// equivalent 4.0-GPA) so the scoring layer can compare students with
// different grading systems on one axis. Pure functions; no I/O.
//
// Confidence captures how well we trust the parse:
//   - 1.0   structured number cleanly extracted on a known scale
//   - 0.6   parsed but imprecise (e.g. uk_class mapped via word matching)
//   - 0.3   partial parse (e.g. only some AP scores recognized)
//   - 0.0   could not parse a numeric signal (free-form certificate / other)
//
// Each kind has a documented mapping below.

import type {
    AcademicCredential,
    AcademicCredentialKind,
    StudentProfile,
} from "../../schemas/index";

export interface NormalizedCredential {
    readonly kind: AcademicCredentialKind;
    readonly raw: string;
    // 0..1 score; null when the credential cannot be normalized.
    readonly value_0to1: number | null;
    // 4.0-scale equivalent; null when value_0to1 is null.
    readonly gpa_4: number | null;
    // 0..1 trust score; 0 means "informational only, do not use for ranking".
    readonly confidence: number;
}

function clamp01(n: number): number {
    if (!Number.isFinite(n)) return 0;
    if (n < 0) return 0;
    if (n > 1) return 1;
    return n;
}

// Pull the first decimal number out of a raw string.
function firstNumber(raw: string): number | null {
    const m = raw.match(/-?\d+(?:\.\d+)?/);
    if (!m) return null;
    const n = Number(m[0]);
    return Number.isFinite(n) ? n : null;
}

// Pull all numbers out of a raw string (for AP score lists etc.).
function allNumbers(raw: string): number[] {
    const matches = raw.match(/-?\d+(?:\.\d+)?/g);
    if (!matches) return [];
    return matches
        .map((m) => Number(m))
        .filter((n) => Number.isFinite(n));
}

// Map an A-level grade letter to a 0..1 score. A*=1.0 down to U=0.0.
const ALEVEL_GRADE_MAP: Record<string, number> = {
    "A*": 1.0,
    A: 0.9,
    B: 0.8,
    C: 0.7,
    D: 0.6,
    E: 0.5,
    U: 0.0,
};

// Map UK class words/synonyms to 0..1.
const UK_CLASS_MAP: ReadonlyArray<{ patterns: RegExp; value: number }> = [
    { patterns: /first[-\s]?class|1st|一等|first/i, value: 0.95 },
    {
        patterns: /upper[-\s]?second|2[:.]?1|二等一|upper/i,
        value: 0.80,
    },
    {
        patterns: /lower[-\s]?second|2[:.]?2|二等二|lower/i,
        value: 0.65,
    },
    { patterns: /third[-\s]?class|3rd|三等/i, value: 0.50 },
    { patterns: /\bpass\b|及格|通过/i, value: 0.40 },
    { patterns: /\bfail\b|不及格|未通过/i, value: 0.10 },
];

function parseAlevel(raw: string): { value: number; confidence: number } | null {
    // Split on common separators OR scan for "A*" tokens first then letters.
    const tokens: string[] = [];
    let i = 0;
    const upper = raw.toUpperCase();
    while (i < upper.length) {
        const ch = upper[i];
        if (ch === undefined) break;
        if (ch === "A" && upper[i + 1] === "*") {
            tokens.push("A*");
            i += 2;
            continue;
        }
        if (ch >= "A" && ch <= "E") {
            tokens.push(ch);
            i += 1;
            continue;
        }
        if (ch === "U") {
            tokens.push("U");
            i += 1;
            continue;
        }
        i += 1;
    }
    if (tokens.length === 0) return null;
    const scores = tokens
        .map((t) => ALEVEL_GRADE_MAP[t])
        .filter((v): v is number => v !== undefined);
    if (scores.length === 0) return null;
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    // Confidence scales with how many tokens we recognized vs the raw length.
    const confidence = scores.length >= 3 ? 1 : 0.7;
    return { value: avg, confidence };
}

export function normalizeCredential(
    c: AcademicCredential,
): NormalizedCredential {
    const base = { kind: c.kind, raw: c.raw };
    const empty: NormalizedCredential = {
        ...base,
        value_0to1: null,
        gpa_4: null,
        confidence: 0,
    };
    const make = (value: number, confidence: number): NormalizedCredential => {
        const v = clamp01(value);
        return {
            ...base,
            value_0to1: v,
            gpa_4: Number((v * 4).toFixed(2)),
            confidence: clamp01(confidence),
        };
    };

    switch (c.kind) {
        case "gpa_4": {
            const n = firstNumber(c.raw);
            if (n === null) return empty;
            return make(n / 4, 1);
        }
        case "gpa_5": {
            const n = firstNumber(c.raw);
            if (n === null) return empty;
            return make(n / 5, 1);
        }
        case "wam_100":
        case "percentage_100": {
            const n = firstNumber(c.raw);
            if (n === null) return empty;
            // WAM bands in AU: 50=pass, 65=credit, 75=distinction, 85=HD. Map
            // linearly across 50..95 to 0.5..1, anything below 50 scales
            // toward 0 quickly.
            if (n < 50) return make(n / 100, 0.9);
            const v = 0.5 + ((n - 50) / 45) * 0.5;
            return make(v, 1);
        }
        case "uk_class": {
            for (const m of UK_CLASS_MAP) {
                if (m.patterns.test(c.raw)) return make(m.value, 0.9);
            }
            return empty;
        }
        case "pass_fail": {
            if (/\bpass\b|及格|通过/i.test(c.raw)) return make(0.55, 0.4);
            if (/\bfail\b|不及格|未通过/i.test(c.raw))
                return make(0.10, 0.6);
            return empty;
        }
        case "gaokao": {
            const n = firstNumber(c.raw);
            if (n === null) return empty;
            // Most provinces: total 750. Some 660-900 variants exist; we
            // detect a max in the raw text ("680/750") if present.
            const maxMatch = c.raw.match(/\/\s*(\d{3,4})/);
            const max = maxMatch ? Number(maxMatch[1]) : 750;
            return make(n / max, 0.9);
        }
        case "ap": {
            const scores = allNumbers(c.raw).filter((n) => n >= 1 && n <= 5);
            if (scores.length === 0) return empty;
            const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
            // 5 = excellent, 3 = passing. Map linearly 1..5 -> 0..1.
            return make((avg - 1) / 4, scores.length >= 3 ? 1 : 0.7);
        }
        case "alevel": {
            const parsed = parseAlevel(c.raw);
            if (!parsed) return empty;
            return make(parsed.value, parsed.confidence);
        }
        case "ib": {
            const n = firstNumber(c.raw);
            if (n === null) return empty;
            // IB total /45; passing ~24, strong ~38+.
            return make(n / 45, 0.9);
        }
        case "sat": {
            const n = firstNumber(c.raw);
            if (n === null) return empty;
            // SAT range 400..1600.
            const v = (n - 400) / 1200;
            return make(v, 0.9);
        }
        case "act": {
            const n = firstNumber(c.raw);
            if (n === null) return empty;
            return make(n / 36, 0.9);
        }
        case "certificate":
        case "other": {
            // Informational only — we do not derive a numeric signal from
            // free-form text. The rule engine will not punish missing data.
            return empty;
        }
        default: {
            return empty;
        }
    }
}

// Pick the best-confidence normalized credential as the academic-fit signal.
// Ties break by higher value_0to1 so a student with both a strong gaokao and
// a weak certificate shows their gaokao.
export function summarizeCredentials(
    credentials: ReadonlyArray<AcademicCredential>,
): NormalizedCredential | null {
    if (credentials.length === 0) return null;
    const normalized = credentials.map(normalizeCredential);
    const usable = normalized.filter(
        (n) => n.value_0to1 !== null && n.confidence > 0,
    );
    if (usable.length === 0) return null;
    usable.sort((a, b) => {
        if (b.confidence !== a.confidence) return b.confidence - a.confidence;
        return (b.value_0to1 ?? 0) - (a.value_0to1 ?? 0);
    });
    return usable[0]!;
}

// Effective 4.0-scale GPA used by the academic-fit dimension and the hard
// threshold check. Preference order:
//   1. profile.academic.gpa (legacy explicit field)
//   2. summarized credentials whose confidence >= 0.5
// Falls back to undefined ("no signal") rather than 0.
export function getEffectiveGpa4(
    profile: StudentProfile,
): number | undefined {
    const explicit = profile.academic.gpa;
    if (typeof explicit === "number") return explicit;
    const summary = summarizeCredentials(profile.academic.credentials);
    if (summary && summary.gpa_4 !== null && summary.confidence >= 0.5) {
        return summary.gpa_4;
    }
    return undefined;
}
