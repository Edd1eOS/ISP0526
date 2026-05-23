// Regex-based enricher that complements (never overwrites) the LLM-driven
// extraction. When Gemini quota is exhausted or the model misses obvious
// signals (e.g. "想学商科", "20 万人民币", "GPA 3.6"), this pass fills the
// gaps so the review page lands with something usable.
//
// All values produced here are tagged with confidence 0.5 and source
// excerpt = the matched substring, so the UI's confidence badge still
// shows "AI 提取 · 待确认".

import type { ExtractedProfile } from "@isp0526/core";

const EXCERPT_PAD = 12;
const TAG_CONF = 0.5;

function excerpt(text: string, idx: number, len: number): string {
    const start = Math.max(0, idx - EXCERPT_PAD);
    const end = Math.min(text.length, idx + len + EXCERPT_PAD);
    return text.slice(start, end).trim().replace(/\s+/g, " ").slice(0, 240);
}

interface Signal<T> {
    value: T;
    confidence: number;
    source_excerpt: string;
}

function makeSignal<T>(value: T, text: string, match: RegExpExecArray): Signal<T> {
    return {
        value,
        confidence: TAG_CONF,
        source_excerpt: excerpt(text, match.index, match[0].length),
    };
}

// Field discipline detection. First match wins; ordering matters
// (specific before generic).
const FIELD_PATTERNS: ReadonlyArray<{ re: RegExp; value: string }> = [
    { re: /土木\s*工程|civil\s*engineering/i, value: "Civil Engineering" },
    { re: /电气\s*工程|electrical\s*engineering/i, value: "Electrical Engineering" },
    { re: /机械\s*工程|mechanical\s*engineering/i, value: "Mechanical Engineering" },
    { re: /数据\s*科学|data\s*science/i, value: "Data Science" },
    { re: /信息技术|information\s*technology|\bit\b/i, value: "Information Technology" },
    { re: /计算机|computer\s*science|computing|cs\b/i, value: "Computing" },
    { re: /金融|finance/i, value: "Finance" },
    { re: /mba|工商管理/i, value: "Business Administration" },
    { re: /商科|商学|business|commerce/i, value: "Business" },
    { re: /tesol|英语教学/i, value: "TESOL" },
    { re: /设计|design/i, value: "Design" },
    { re: /工程|engineering/i, value: "Civil Engineering" },
];

function detectField(text: string): Signal<string> | undefined {
    for (const p of FIELD_PATTERNS) {
        const m = p.re.exec(text);
        if (m) return makeSignal(p.value, text, m);
    }
    return undefined;
}

function detectLevel(
    text: string,
): Signal<"bachelor" | "master" | "phd"> | undefined {
    const phd = /(读|想读|攻读|去读)?\s*博士|phd|doctor/i.exec(text);
    if (phd) return makeSignal("phd", text, phd);
    const master = /(读|想读|攻读|去读)?\s*硕士|研究生|master/i.exec(text);
    if (master) return makeSignal("master", text, master);
    const bach = /本科|学士|undergrad|bachelor/i.exec(text);
    if (bach) return makeSignal("bachelor", text, bach);
    return undefined;
}

function detectGpa(text: string): Signal<number> | undefined {
    const m = /gpa\s*[:：]?\s*(\d+(?:\.\d+)?)/i.exec(text);
    if (!m) return undefined;
    const n = parseFloat(m[1]);
    let value: number | undefined;
    if (n >= 0 && n <= 4) value = n;
    else if (n > 4 && n <= 5) value = Math.round((n / 5) * 4 * 100) / 100;
    else if (n > 5 && n <= 100) value = Math.round((n / 100) * 4 * 100) / 100;
    if (value === undefined) return undefined;
    return makeSignal(value, text, m);
}

function detectIelts(text: string): Signal<number> | undefined {
    const m = /(?:雅思|ielts)\s*(?:总分)?\s*[:：]?\s*(\d+(?:\.\d+)?)/i.exec(text);
    if (!m) return undefined;
    const n = parseFloat(m[1]);
    if (n < 0 || n > 9) return undefined;
    return makeSignal(n, text, m);
}

// Currency conversion table (rough, to AUD). The k-suffix variants come
// before the bare-number variants so "60k人民币" wins over a generic match.
const CURRENCY: ReadonlyArray<{ re: RegExp; rate: number }> = [
    { re: /(\d+(?:\.\d+)?)\s*(?:亿)\s*(?:rmb|cny|人民币|元)?/i, rate: 1 / 4.7 },
    { re: /(\d+(?:\.\d+)?)\s*万\s*(?:aud|澳币|澳元)/i, rate: 1 },
    { re: /(\d+(?:\.\d+)?)\s*万\s*(?:rmb|cny|人民币|元)/i, rate: 1 / 4.7 },
    { re: /(\d+(?:\.\d+)?)\s*万\s*(?:usd|美元|美刀)/i, rate: 1.5 },
    { re: /(\d+(?:\.\d+)?)\s*万/i, rate: 1 / 4.7 },
    { re: /(\d+(?:\.\d+)?)\s*k\s*(?:aud|澳币|澳元)/i, rate: 1 },
    { re: /(\d+(?:\.\d+)?)\s*k\s*(?:rmb|cny|人民币|元)/i, rate: 1 / 4.7 },
    { re: /(\d+(?:\.\d+)?)\s*k\s*(?:usd|美元)/i, rate: 1.5 },
    { re: /(\d+(?:\.\d+)?)\s*k\b/i, rate: 1 }, // bare "60k" -> AUD
    { re: /(\d+(?:,\d{3})*)\s*(?:aud|澳币|澳元)/i, rate: 1 },
    { re: /(\d+(?:,\d{3})*)\s*(?:usd|美元)/i, rate: 1.5 },
    { re: /(\d+(?:,\d{3})*)\s*(?:rmb|cny|人民币|元)/i, rate: 1 / 4.7 },
];

function detectBudget(text: string): Signal<number> | undefined {
    for (const c of CURRENCY) {
        const m = c.re.exec(text);
        if (!m) continue;
        const raw = parseFloat(m[1].replace(/,/g, ""));
        const isYi = /亿/.test(m[0]);
        const isWan = /万/.test(m[0]);
        const isK = /k/i.test(m[0]) && !/[a-z]/i.test(m[0].replace(/k/gi, ""));
        const baseUnits = isYi
            ? raw * 1e8
            : isWan
              ? raw * 1e4
              : isK
                ? raw * 1e3
                : raw;
        const aud = Math.round(baseUnits * c.rate);
        if (aud < 5000 || aud > 500000) continue;
        return makeSignal(aud, text, m);
    }
    return undefined;
}

export function enrichExtraction(
    extracted: ExtractedProfile,
    sourceText: string,
): ExtractedProfile {
    const academic = { ...extracted.academic };
    const budget = { ...extracted.budget };

    if (!academic.target_field) {
        const v = detectField(sourceText);
        if (v) academic.target_field = v;
    }
    if (!academic.target_level) {
        const v = detectLevel(sourceText);
        if (v) academic.target_level = v;
    }
    if (!academic.gpa) {
        const v = detectGpa(sourceText);
        if (v) academic.gpa = v;
    }
    if (!academic.ielts_overall) {
        const v = detectIelts(sourceText);
        if (v) academic.ielts_overall = v;
    }
    if (!budget.annual_aud) {
        const v = detectBudget(sourceText);
        if (v) budget.annual_aud = v;
    }

    return {
        academic,
        budget,
        unstructured_notes: extracted.unstructured_notes,
    };
}
