"use client";

/**
 * StarChartStage — adaptive intake stage.
 *
 * Flow:
 *   1. Fixed pickers: 学习阶段 → 阶段补充 → 方向
 *      (PickerSky constellation tap; 方向 stars are highlighted by RIASEC)
 *   2. Adaptive LLM questions (max 7) generated one at a time by
 *      generateNextAdaptiveQuestionAction — quick-pick buttons.
 *   3. Pre-readout conflict resolution if two sources disagree.
 *   4. Readout: star diagnosis + "查看推荐" button.
 *
 * The astrolabe is decorative only; free-form search is intentionally
 * disabled until the parser path is stable.
 */

import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    useTransition,
    type CSSProperties,
} from "react";
import styles from "./star-chart.module.css";
import { nextFixedQuestion, nextConflictQuestion, type Question, type ResolveQuestion } from "./engine";
import {
    diagnoseStarsAction,
    finalizeStarsAction,
    generateNextAdaptiveQuestionAction,
    parseWishAction,
} from "./stars-actions";
import {
    appendConversationTurn,
    commitWish,
    emptyLedger,
    ledgerToClarifyPatch,
    mergeBudget,
    mergeCitySize,
    mergeCountries,
    mergeTags,
    mergeTargetField,
    mergeTargetLevel,
    mergeTeachingStyle,
    resolveConflict,
    setWish,
    type KnowledgeLedger,
    type LedgerFacts,
    type Source,
    type Tag,
    type TargetLevel,
    type TeachingStyle,
    type CitySize,
} from "./ledger";
import type { Country } from "@isp0526/core";
import type { PickerNight, StarDef } from "./types";
import type { StarDiagnosis, StarPickLine, WishExtracted } from "@isp0526/core";
import type { ClarifyPatch } from "../intake-clarify/clarify-schema";
import type { AssessmentAnswers } from "../assessment/items";
import { scoreAssessment, type RiasecDim } from "../assessment/items";

const ASSESSMENT_KEY = "isp_assessment_v1";
const INTAKE_PATCH_KEY = "isp_intake_accumulated_v1";
const LEDGER_KEY = "isp_ledger_v1";

// Maximum total main questions (fixed + adaptive). Fixed = 3 (level,
// supplement, field), so adaptive limit = MAX_QUESTIONS - 3.
const MAX_QUESTIONS = 10;
const MAX_ADAPTIVE = MAX_QUESTIONS - 3;

// Fallback questions used when the LLM declares done too early (< MIN_ADAPTIVE turns)
// or when the API call fails. Ordered by importance for program matching.
const MIN_ADAPTIVE = 2;

interface FallbackQuestion {
    readonly question: string;
    readonly quickPicks: ReadonlyArray<string>;
    readonly multiSelect?: boolean;
}

const FALLBACK_ADAPTIVE_QUESTIONS: ReadonlyArray<FallbackQuestion> = [
    {
        question: "你在考虑哪些国家 / 地区？（可多选）",
        quickPicks: ["仅澳大利亚", "英国 / 爱尔兰", "美国 / 加拿大", "新加坡 / 港澳", "德国 / 荷兰", "马来西亚 / 泰国"],
        multiSelect: true,
    },
    {
        question: "你的年度留学预算大概在哪个区间？",
        quickPicks: ["20 万以内", "20–30 万", "30–40 万", "40–50 万", "50 万以上"],
    },
    {
        question: "学完之后你最希望做什么？",
        quickPicks: ["当地就业 / 移民", "回国发展", "继续深造", "创业", "还没想好"],
    },
];

// Preset star positions (x%, y%) in the sky area for 2-6 quick-pick options.
const QUICK_PICK_POSITIONS: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
    /* 0 */ [],
    /* 1 */ [[50, 44]],
    /* 2 */ [[30, 42], [68, 36]],
    /* 3 */ [[24, 36], [54, 26], [76, 48]],
    /* 4 */ [[22, 40], [50, 24], [72, 36], [60, 62]],
    /* 5 */ [[22, 38], [48, 22], [72, 30], [76, 56], [36, 62]],
    /* 6 */ [[22, 38], [48, 22], [72, 30], [78, 56], [52, 64], [26, 60]],
];

type Phase = "questions" | "readout";

function readSession<T>(key: string): T | undefined {
    if (typeof window === "undefined") return undefined;
    try {
        const raw = window.sessionStorage.getItem(key);
        if (!raw) return undefined;
        return JSON.parse(raw) as T;
    } catch {
        return undefined;
    }
}

function writeSession(key: string, value: unknown): void {
    if (typeof window === "undefined") return;
    try {
        window.sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
        // ignore quota
    }
}

// ---------------------------------------------------------------------------
// Ledger hydration
// ---------------------------------------------------------------------------

function hydrateLedger(): KnowledgeLedger {
    let l = emptyLedger();
    const prev = readSession<KnowledgeLedger>(LEDGER_KEY);
    if (prev) {
        // Back-fill new fields for ledgers persisted before this version.
        return {
            ...prev,
            conversationHistory: prev.conversationHistory ?? [],
            adaptiveQuestionCount: prev.adaptiveQuestionCount ?? 0,
            committedWishes: prev.committedWishes ?? [],
        };
    }

    const answers = readSession<AssessmentAnswers>(ASSESSMENT_KEY);
    if (answers) {
        try {
            const s = scoreAssessment(answers);
            if (s.learning.teaching_style) {
                l = mergeTeachingStyle(l, s.learning.teaching_style, { source: "assessment" });
            }
            if (s.lifestyle.city_size) {
                l = mergeCitySize(l, s.lifestyle.city_size, { source: "assessment" });
            }
        } catch {
            // ignore
        }
    }

    const patch = readSession<ClarifyPatch>(INTAKE_PATCH_KEY);
    if (patch) {
        const src: Source = "upload";
        if (patch.target_level) l = mergeTargetLevel(l, patch.target_level, { source: src });
        if (patch.target_field) l = mergeTargetField(l, patch.target_field, { source: src });
        if (patch.annual_budget_aud != null) l = mergeBudget(l, patch.annual_budget_aud, { source: src });
        if (patch.teaching_style) l = mergeTeachingStyle(l, patch.teaching_style, { source: src });
        if (patch.city_size) l = mergeCitySize(l, patch.city_size, { source: src });
        if (patch.preferred_tags && patch.preferred_tags.length > 0) {
            l = mergeTags(l, patch.preferred_tags as ReadonlyArray<Tag>, { source: src });
        }
        if (patch.preferred_countries && patch.preferred_countries.length > 0) {
            l = mergeCountries(l, patch.preferred_countries as ReadonlyArray<Country>, { source: src });
        }
    }
    return l;
}

// ---------------------------------------------------------------------------
// Picker meta projection
// ---------------------------------------------------------------------------

function applyStarMeta(
    ledger: KnowledgeLedger,
    meta: NonNullable<StarDef["meta"]>,
): KnowledgeLedger {
    let l = ledger;
    if (meta.target_level) l = mergeTargetLevel(l, meta.target_level, { source: "star" });
    if (meta.target_field) l = mergeTargetField(l, meta.target_field, { source: "star" });
    if (meta.teaching_style) l = mergeTeachingStyle(l, meta.teaching_style, { source: "star" });
    if (meta.city_size) l = mergeCitySize(l, meta.city_size, { source: "star" });
    if (meta.annual_budget_aud != null) l = mergeBudget(l, meta.annual_budget_aud, { source: "star" });
    if (meta.preferred_tags && meta.preferred_tags.length > 0) {
        l = mergeTags(l, meta.preferred_tags, { source: "star" });
    }
    return l;
}

// ---------------------------------------------------------------------------
// Diagnosis helpers
// ---------------------------------------------------------------------------

interface ProfileItem {
    readonly label: string;
    readonly value: string;
    readonly faint?: boolean;
}

function buildProfileSummary(ledger: KnowledgeLedger): ReadonlyArray<ProfileItem> {
    const items: ProfileItem[] = [];
    const f = ledger.facts;
    if (f.target_level) {
        const map: Record<string, string> = { bachelor: "本科", master: "硕士", phd: "博士" };
        items.push({ label: "学习阶段", value: map[String(f.target_level.value)] ?? String(f.target_level.value) });
    }
    if (f.target_field) {
        const map: Record<string, string> = {
            Computing: "计算机 / 工程",
            Business: "商科 / 金融",
            Design: "设计 / 创意",
            "Data Science": "数据 / 分析",
            TESOL: "教育 / 语言",
        };
        items.push({ label: "目标方向", value: map[String(f.target_field.value)] ?? String(f.target_field.value) });
    }
    if (f.annual_budget_aud) {
        const v = f.annual_budget_aud.value;
        const wan = (v / 10000).toFixed(v % 10000 === 0 ? 0 : 1);
        items.push({ label: "年度预算", value: `${wan} 万 AUD` });
    }
    if (f.city_size) {
        const map: Record<string, string> = { mega: "超大城市", large: "大城市", medium: "中型城市", small: "小城" };
        items.push({ label: "城市规模", value: map[String(f.city_size.value)] ?? String(f.city_size.value) });
    }
    if (f.teaching_style) {
        const map: Record<string, string> = { theory_heavy: "偏理论", balanced: "理论 · 实践均衡", applied_heavy: "偏实践" };
        items.push({ label: "教学风格", value: map[String(f.teaching_style.value)] ?? String(f.teaching_style.value) });
    }
    if (f.preferred_countries?.value.length) {
        const countryNames: Record<string, string> = {
            AU: "澳大利亚", US: "美国", UK: "英国", CA: "加拿大", NZ: "新西兰",
            HK: "香港", SG: "新加坡", MY: "马来西亚", TH: "泰国",
            DE: "德国", NL: "荷兰", IE: "爱尔兰", RU: "俄罗斯", TW: "中国台湾", MO: "中国澳门",
        };
        const names = [...f.preferred_countries.value].map((c) => countryNames[c] ?? c);
        items.push({ label: "目标国家", value: names.join(" · ") });
    }
    if (f.preferred_tags?.value.length) {
        items.push({ label: "偏好", value: [...f.preferred_tags.value].join(" · ") });
    }
    // Conversation data as a summary count
    const turnCount = ledger.conversationHistory.length;
    if (turnCount > 0) {
        items.push({ label: "补充问答", value: `${turnCount} 轮`, faint: true });
    }
    return items;
}

function buildPickLines(ledger: KnowledgeLedger): StarPickLine[] {
    const lines: StarPickLine[] = [];
    const f = ledger.facts;
    if (f.target_level) lines.push({ night: "学习阶段", picks: [String(f.target_level.value)] });
    if (f.target_field) lines.push({ night: "方向", picks: [String(f.target_field.value)] });
    if (f.annual_budget_aud) {
        const v = f.annual_budget_aud.value;
        const wan = (v / 10000).toFixed(v % 10000 === 0 ? 0 : 1);
        lines.push({ night: "预算", picks: [`${wan} 万 AUD/年`] });
    }
    if (f.preferred_countries?.value.length) lines.push({ night: "目标国家", picks: [...f.preferred_countries.value] });
    if (f.preferred_tags?.value.length) lines.push({ night: "看重的事", picks: [...f.preferred_tags.value] });
    if (f.city_size) lines.push({ night: "城市规模", picks: [String(f.city_size.value)] });
    if (f.teaching_style) lines.push({ night: "教学风格", picks: [String(f.teaching_style.value)] });
    return lines;
}

function combinedWish(ledger: KnowledgeLedger): string {
    const parts: string[] = [];
    // Adaptive Q&A history
    for (const turn of ledger.conversationHistory) {
        if (turn.answer.trim()) parts.push(`问：${turn.question}\n答：${turn.answer}`);
    }
    // Per-question contextual text from supplementary pickers.
    for (const [, v] of Object.entries(ledger.wishes)) {
        const t = v.trim();
        if (t) parts.push(t);
    }
    const free = ledger.freeNotes.trim();
    if (free) parts.push(free);
    return parts.join("\n\n").slice(0, 1200);
}

function factsToStringRecord(facts: LedgerFacts): Record<string, string> {
    const out: Record<string, string> = {};
    if (facts.target_level) out.target_level = String(facts.target_level.value);
    if (facts.target_field) out.target_field = String(facts.target_field.value);
    if (facts.annual_budget_aud) out.annual_budget_aud = String(facts.annual_budget_aud.value);
    if (facts.city_size) out.city_size = String(facts.city_size.value);
    if (facts.teaching_style) out.teaching_style = String(facts.teaching_style.value);
    if (facts.preferred_countries?.value.length)
        out.preferred_countries = [...facts.preferred_countries.value].join(",");
    return out;
}

// ---------------------------------------------------------------------------
// RIASEC → field star highlight mapping
//
// Weights are per-field Holland loadings derived from:
//   Holland (1997) Making Vocational Choices; O*NET Content Model;
//   Australian Graduate Outcomes Survey field-to-RIASEC crosswalk.
//
// Each row sums to ~1.0. The algorithm scores every field against the
// student's RIASEC profile, then surfaces the top-N by score.
// ---------------------------------------------------------------------------

const FIELD_RIASEC_WEIGHTS: Readonly<Record<string, Readonly<Partial<Record<RiasecDim, number>>>>> = {
    // Realistic(R): hands-on/technical. Investigative(I): analytical.
    cs_eng:     { realistic: 0.65, investigative: 0.55, conventional: 0.20 },
    // Investigative dominant; Conventional for statistics/modelling.
    data:       { investigative: 0.75, conventional: 0.55, realistic: 0.25 },
    // Pure Investigative; Realistic for lab/fieldwork side.
    science:    { investigative: 0.90, realistic: 0.35 },
    // Social for care/nursing; Investigative for research medicine.
    health:     { social: 0.65, investigative: 0.50, realistic: 0.20 },
    // Enterprising dominant; Conventional for accounting/finance.
    business:   { enterprising: 0.80, conventional: 0.65, investigative: 0.15 },
    // Artistic dominant; Realistic for craft/production skills.
    design:     { artistic: 0.90, realistic: 0.25 },
    // Social dominant for teaching/counselling; Artistic for language arts.
    education:  { social: 0.80, artistic: 0.30 },
    // Artistic + Social + Investigative blend (varies by sub-discipline).
    humanities: { artistic: 0.55, social: 0.45, investigative: 0.30 },
};

// Return the top-N field IDs whose weighted Holland score is highest.
// Only fields that clear a minimum threshold are included.
function computeTopHollandFields(
    riasec: Readonly<Partial<Record<RiasecDim, number>>> | undefined,
    maxFields = 3,
    minScore = 0.28,
): Set<string> {
    const out = new Set<string>();
    if (!riasec) return out;

    const scored = Object.entries(FIELD_RIASEC_WEIGHTS).map(([id, weights]) => {
        const score = (Object.entries(weights) as [RiasecDim, number][]).reduce(
            (sum, [dim, w]) => sum + (riasec[dim] ?? 0) * w,
            0,
        );
        return { id, score };
    });

    scored
        .sort((a, b) => b.score - a.score)
        .slice(0, maxFields)
        .filter((s) => s.score >= minScore)
        .forEach((s) => out.add(s.id));

    return out;
}

function applyExtractedFacts(l: KnowledgeLedger, extracted: WishExtracted): KnowledgeLedger {
    if (!extracted) return l;
    let next = l;
    if (extracted.target_level)
        next = mergeTargetLevel(next, extracted.target_level, { source: "wish" });
    if (extracted.target_field)
        next = mergeTargetField(next, extracted.target_field, { source: "wish" });
    if (extracted.city_size)
        next = mergeCitySize(next, extracted.city_size, { source: "wish", confidence: 0.65 });
    if (extracted.annual_budget_aud)
        next = mergeBudget(next, extracted.annual_budget_aud, { source: "wish", confidence: 0.65 });
    if (extracted.teaching_style)
        next = mergeTeachingStyle(next, extracted.teaching_style, { source: "wish", confidence: 0.65 });
    if (extracted.preferred_tags?.length)
        next = mergeTags(next, extracted.preferred_tags, { source: "wish" });
    if (extracted.preferred_countries?.length)
        next = mergeCountries(next, extracted.preferred_countries as ReadonlyArray<Country>, { source: "wish", confidence: 0.8 });
    return next;
}

// ---------------------------------------------------------------------------
// StarChartStage
// ---------------------------------------------------------------------------

export function StarChartStage() {
    const [mounted, setMounted] = useState(false);
    const [ledger, setLedger] = useState<KnowledgeLedger>(emptyLedger);
    const [phase, setPhase] = useState<Phase>("questions");
    const [diagnosis, setDiagnosis] = useState<StarDiagnosis | null>(null);
    const [diagError, setDiagError] = useState<string | null>(null);
    const [diagLoading, setDiagLoading] = useState(false);
    const [fading, setFading] = useState(false);
    const [, startTransition] = useTransition();
    const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Undo stack
    const [factsHistory, setFactsHistory] = useState<ReadonlyArray<LedgerFacts>>([]);
    const prevFactsRef = useRef<LedgerFacts | null>(null);
    const undoingRef = useRef(false);

    // Adaptive question state
    const [adaptiveQuestion, setAdaptiveQuestion] = useState<{
        id: string;
        question: string;
        quickPicks: ReadonlyArray<string>;
        multiSelect?: boolean;
    } | null>(null);
    const [adaptiveLoading, setAdaptiveLoading] = useState(false);
    const [adaptiveDone, setAdaptiveDone] = useState(false);
    const adaptiveFetchingRef = useRef(false);

    // RIASEC scores derived from assessment (stable after mount)
    const riasecRef = useRef<Readonly<Partial<Record<RiasecDim, number>>> | undefined>(undefined);
    const hollandHighlightsRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        setMounted(true);
        const l = hydrateLedger();
        setLedger(l);
        const answers = readSession<AssessmentAnswers>(ASSESSMENT_KEY);
        if (answers) {
            try {
                const s = scoreAssessment(answers);
                if (s.career.interests) {
                    riasecRef.current = s.career.interests as Readonly<Partial<Record<RiasecDim, number>>>;
                    hollandHighlightsRef.current = computeTopHollandFields(riasecRef.current);
                }
            } catch {
                // ignore
            }
        }
    }, []);

    useEffect(() => {
        if (mounted) writeSession(LEDGER_KEY, ledger);
    }, [mounted, ledger]);

    // Fixed questions from engine (level → supplement → field)
    const fixedQuestion = useMemo<Question | null>(
        () => (mounted ? nextFixedQuestion(ledger) : null),
        [mounted, ledger],
    );

    // Conflict resolution question (called after adaptive phase is done)
    const conflictQuestion = useMemo<ResolveQuestion | null>(
        () => (mounted && adaptiveDone ? nextConflictQuestion(ledger) : null),
        [mounted, adaptiveDone, ledger],
    );

    // Determine effective current question for the UI
    const currentQuestion: Question | null =
        fixedQuestion ?? (adaptiveDone ? (conflictQuestion ?? null) : null);

    // When in the adaptive phase (no fixed question, not yet done), trigger LLM
    useEffect(() => {
        if (!mounted) return;
        if (fixedQuestion !== null) return;
        if (adaptiveDone) return;
        if (adaptiveQuestion !== null) return;
        if (adaptiveLoading) return;
        if (adaptiveFetchingRef.current) return;

        adaptiveFetchingRef.current = true;
        setAdaptiveLoading(true);

        const knownFacts = factsToStringRecord(ledger.facts);
        const history = ledger.conversationHistory.map((t) => ({
            question: t.question,
            answer: t.answer,
        }));
        const freeNotes = ledger.freeNotes.trim() || undefined;

        const qCount = ledger.adaptiveQuestionCount;

        void generateNextAdaptiveQuestionAction({
            locale: "zh",
            knownFacts: Object.keys(knownFacts).length > 0 ? knownFacts : undefined,
            history,
            questionCount: qCount,
            maxQuestions: MAX_ADAPTIVE,
            riasec: riasecRef.current,
            freeNotes,
        })
            .then((res) => {
                // Guard: if LLM declares done too early, use a fallback question.
                const isDone = !res.ok || !res.result || res.result.done;
                if (isDone && qCount < MIN_ADAPTIVE) {
                    // Find the first fallback question not yet covered by knownFacts.
                    const hasCountries = !!knownFacts.preferred_countries;
                    const hasBudget = !!knownFacts.annual_budget_aud ||
                        Object.values(ledger.wishes).some((w) => /万|AUD|预算/i.test(w));
                    const fallbackPool = FALLBACK_ADAPTIVE_QUESTIONS.filter((_, i) => {
                        if (i === 0 && hasCountries) return false;
                        if (i === 1 && hasBudget) return false;
                        return true;
                    });
                    const fallback = fallbackPool[qCount] ?? fallbackPool[0];
                    if (fallback) {
                        setAdaptiveQuestion({
                            id: `adaptive_${qCount}`,
                            question: fallback.question,
                            quickPicks: fallback.quickPicks,
                            multiSelect: fallback.multiSelect,
                        });
                        return;
                    }
                }
                if (isDone) {
                    setAdaptiveDone(true);
                    return;
                }
                setAdaptiveQuestion({
                    id: `adaptive_${qCount}`,
                    question: res.result!.question!,
                    quickPicks: res.result!.quickPicks ?? [],
                    multiSelect: res.result!.multiSelect,
                });
            })
            .catch(() => {
                // On failure, use a fallback question rather than jumping to readout.
                const qCount2 = ledger.adaptiveQuestionCount;
                const kf2 = factsToStringRecord(ledger.facts);
                const fallbackPool2 = FALLBACK_ADAPTIVE_QUESTIONS.filter((_, i) => {
                    if (i === 0 && !!kf2.preferred_countries) return false;
                    if (i === 1 && !!kf2.annual_budget_aud) return false;
                    return true;
                });
                const fallback = fallbackPool2[qCount2] ?? fallbackPool2[0];
                if (fallback && qCount2 < MIN_ADAPTIVE) {
                    setAdaptiveQuestion({
                        id: `adaptive_${qCount2}`,
                        question: fallback.question,
                        quickPicks: fallback.quickPicks,
                        multiSelect: fallback.multiSelect,
                    });
                } else {
                    setAdaptiveDone(true);
                }
            })
            .finally(() => {
                setAdaptiveLoading(false);
                adaptiveFetchingRef.current = false;
            });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mounted, fixedQuestion, adaptiveDone, adaptiveQuestion, adaptiveLoading, ledger.adaptiveQuestionCount, ledger.facts]);

    // Transition to readout once adaptive is done and no conflicts remain
    useEffect(() => {
        if (!mounted) return;
        if (phase !== "questions") return;
        if (fixedQuestion !== null) return;
        if (!adaptiveDone) return;
        if (conflictQuestion !== null) return;
        if (adaptiveQuestion !== null) return;

        setFading(true);
        fadeTimer.current = setTimeout(() => {
            setPhase("readout");
            setFading(false);
        }, 420);
    }, [mounted, phase, fixedQuestion, adaptiveDone, conflictQuestion, adaptiveQuestion]);

    // Fire diagnosis once when entering readout
    useEffect(() => {
        if (phase !== "readout") return;
        if (diagnosis || diagLoading) return;
        const answers = readSession<AssessmentAnswers>(ASSESSMENT_KEY);
        let bigFive: Record<string, number> | undefined;
        if (answers) {
            try {
                bigFive = scoreAssessment(answers).big_five as unknown as Record<string, number>;
            } catch { bigFive = undefined; }
        }
        const wish = combinedWish(ledger);
        setDiagLoading(true);
        setDiagError(null);
        void diagnoseStarsAction({
            locale: "zh",
            lines: buildPickLines(ledger),
            ...(bigFive ? { bigFive } : {}),
            ...(wish ? { wishText: wish } : {}),
        })
            .then((res) => {
                if (res.ok && res.diagnosis) setDiagnosis(res.diagnosis);
                else setDiagError(res.error ?? "生成失败");
            })
            .catch((cause: unknown) => {
                setDiagError(cause instanceof Error ? cause.message : "网络错误");
            })
            .finally(() => setDiagLoading(false));
    }, [phase, ledger, diagnosis, diagLoading]);

    useEffect(() => {
        return () => {
            if (fadeTimer.current) clearTimeout(fadeTimer.current);
        };
    }, []);

    // Undo tracking
    useEffect(() => {
        if (!mounted) return;
        const prev = prevFactsRef.current;
        prevFactsRef.current = ledger.facts;
        if (undoingRef.current) { undoingRef.current = false; return; }
        if (prev !== null && prev !== ledger.facts) {
            setFactsHistory((h) => [...h, prev]);
        }
    }, [mounted, ledger.facts]);

    const canUndo = phase === "questions" && factsHistory.length > 0;

    const undo = useCallback(() => {
        if (factsHistory.length === 0) return;
        const prev = factsHistory[factsHistory.length - 1];
        undoingRef.current = true;
        setFactsHistory((h) => h.slice(0, -1));
        setLedger((l) => ({ ...l, facts: prev, confirmations: {} }));
    }, [factsHistory]);

    const finalize = useCallback(() => {
        const overlay = ledgerToClarifyPatch(ledger);
        const accumulated = readSession<ClarifyPatch>(INTAKE_PATCH_KEY) ?? {};
        writeSession(INTAKE_PATCH_KEY, { ...accumulated, ...overlay });
        const assessment = readSession<AssessmentAnswers>(ASSESSMENT_KEY);
        startTransition(() => {
            void finalizeStarsAction(overlay, accumulated, assessment).catch((cause: unknown) => {
                setDiagError(cause instanceof Error ? cause.message : "提交失败,请重试");
            });
        });
    }, [ledger]);

    // Called by AdaptiveQuestionView when the user submits an answer.
    // Stores the turn in conversationHistory AND tries to extract any
    // structured facts (budget, city_size, etc.) from the answer text.
    const onAdaptiveAnswer = useCallback(
        (answer: string) => {
            if (!adaptiveQuestion) return;
            const turn = {
                qid: adaptiveQuestion.id,
                question: adaptiveQuestion.question,
                answer,
            };
            setLedger((l) => appendConversationTurn(l, turn));
            setAdaptiveQuestion(null);
            // Extract structured facts from the answer using the question as
            // context so the wish-parse LLM understands what was being asked.
            const currentFacts = factsToStringRecord(ledger.facts);
            void parseWishAction({
                locale: "zh",
                wishText: answer,
                currentQuestionContext: adaptiveQuestion.question,
                ...(Object.keys(currentFacts).length > 0 ? { currentFacts } : {}),
            })
                .then((res) => {
                    if (res.ok && res.result?.extracted) {
                        setLedger((l) => applyExtractedFacts(l, res.result!.extracted));
                    }
                })
                .catch(() => {});
        },
        [adaptiveQuestion, ledger.facts],
    );

    if (!mounted) {
        return <div className={styles.stage} aria-hidden />;
    }

    return (
        <div className={styles.stage} aria-label="星图">
            <div className={styles.starfield} aria-hidden />
            <span className={styles.shootingStar} aria-hidden />
            <span className={`${styles.shootingStar} ${styles.b}`} aria-hidden />

            {phase === "questions" ? (
                currentQuestion ? (
                    <QuestionView
                        question={currentQuestion}
                        setLedger={setLedger}
                        canUndo={canUndo}
                        onUndo={undo}
                        hollandHighlights={hollandHighlightsRef.current}
                    />
                ) : adaptiveLoading ? (
                    <section className={styles.sky} aria-label="生成中">
                        <p className={styles.adaptiveLoading}>正在思考下一个问题……</p>
                    </section>
                ) : adaptiveQuestion ? (
                    <AdaptiveQuestionView
                        question={adaptiveQuestion}
                        onAnswer={onAdaptiveAnswer}
                        canUndo={canUndo}
                        onUndo={undo}
                    />
                ) : (
                    <section className={styles.sky} aria-hidden />
                )
            ) : (
                <ReadoutView
                    loading={diagLoading}
                    diagnosis={diagnosis}
                    error={diagError}
                    ledger={ledger}
                    onFinalize={finalize}
                    onRetry={() => { setDiagnosis(null); setDiagError(null); }}
                />
            )}

            {phase === "questions" ? (
                <DecorativeAstrolabe />
            ) : null}

            <div className={`${styles.fadeOverlay} ${fading ? styles.show : ""}`} aria-hidden />
        </div>
    );
}

// ---------------------------------------------------------------------------
// QuestionView dispatcher (fixed picker + resolve only)
// ---------------------------------------------------------------------------

interface QuestionViewProps {
    readonly question: Question;
    readonly setLedger: React.Dispatch<React.SetStateAction<KnowledgeLedger>>;
    readonly canUndo: boolean;
    readonly onUndo: () => void;
    readonly hollandHighlights: Set<string>;
}

function QuestionView({ question, setLedger, canUndo, onUndo, hollandHighlights }: QuestionViewProps) {
    if (question.kind === "picker") {
        return (
            <PickerQuestionView
                question={question}
                setLedger={setLedger}
                canUndo={canUndo}
                onUndo={onUndo}
                hollandHighlights={hollandHighlights}
            />
        );
    }
    return <ResolveView question={question} setLedger={setLedger} />;
}

// ---------------------------------------------------------------------------
// PickerQuestionView
// ---------------------------------------------------------------------------

interface PickerQuestionViewProps {
    readonly question: { kind: "picker"; id: string; template: PickerNight };
    readonly setLedger: React.Dispatch<React.SetStateAction<KnowledgeLedger>>;
    readonly canUndo: boolean;
    readonly onUndo: () => void;
    readonly hollandHighlights: Set<string>;
}

function PickerQuestionView({ question, setLedger, canUndo, onUndo, hollandHighlights }: PickerQuestionViewProps) {
    const night = question.template;
    const [picks, setPicks] = useState<ReadonlyArray<string>>([]);

    useEffect(() => { setPicks([]); }, [question.id]);

    const onToggle = useCallback(
        (starId: string) => {
            setPicks((list) => {
                if (list.includes(starId)) return list.filter((id) => id !== starId);
                if (list.length >= night.maxPicks) return [...list.slice(1), starId];
                return [...list, starId];
            });
        },
        [night.maxPicks],
    );

    const canAdvance = picks.length >= night.minPicks;

    const onAdvance = () => {
        if (!canAdvance) return;
        if (night.storeAsWish) {
            const labels = picks
                .map((id) => night.stars.find((s) => s.id === id)?.label ?? id)
                .join("、");
            setLedger((l) => {
                let next = setWish(l, question.id, labels);
                next = commitWish(next, question.id);
                return next;
            });
        } else {
            const starMap = new Map(night.stars.map((s) => [s.id, s]));
            setLedger((l) => {
                let next = l;
                for (const id of picks) {
                    const s = starMap.get(id);
                    if (s?.meta) next = applyStarMeta(next, s.meta);
                }
                return next;
            });
        }
    };

    return (
        <>
            <header className={styles.header}>
                <h1 className={styles.title} key={night.id}>{night.title}</h1>
                <p className={styles.subtitle}>{night.subtitle}</p>
            </header>
            <PickerSky
                night={night}
                current={picks}
                onToggle={onToggle}
                hollandHighlights={night.id === "field" ? hollandHighlights : undefined}
            />
            {question.id === "field" && hollandHighlights.size > 0 ? (
                <HollandRecommendCard stars={night.stars} highlights={hollandHighlights} />
            ) : null}
            <footer className={styles.footer}>
                <p className={styles.hint}>{pickerHint(night, picks)}</p>
                <div className={styles.footerActions}>
                    {canUndo ? (
                        <button type="button" className={styles.undoBtn} onClick={onUndo}>
                            ← 上一步
                        </button>
                    ) : null}
                    <button
                        type="button"
                        className={styles.advance}
                        disabled={!canAdvance}
                        onClick={onAdvance}
                    >
                        继续
                    </button>
                </div>
            </footer>
        </>
    );
}

function pickerHint(night: PickerNight, picks: ReadonlyArray<string>): string {
    if (picks.length === 0)
        return night.minPicks === night.maxPicks
            ? `点亮 ${night.minPicks} 颗星`
            : `点亮 ${night.minPicks}–${night.maxPicks} 颗星`;
    if (picks.length < night.minPicks) return `还差 ${night.minPicks - picks.length} 颗`;
    if (picks.length >= night.maxPicks && night.maxPicks > 1) return "再点其他星会替换掉最早的选择";
    return "想再多点亮一颗也可以";
}

// ---------------------------------------------------------------------------
// AdaptiveQuestionView — LLM-generated question with quick-pick buttons
// ---------------------------------------------------------------------------

interface AdaptiveQuestionViewProps {
    readonly question: { id: string; question: string; quickPicks: ReadonlyArray<string>; multiSelect?: boolean };
    readonly onAnswer: (answer: string) => void;
    readonly canUndo: boolean;
    readonly onUndo: () => void;
}

function AdaptiveQuestionView({ question, onAnswer, canUndo, onUndo }: AdaptiveQuestionViewProps) {
    const [picks, setPicks] = useState<ReadonlyArray<string>>([]);
    const isMulti = question.multiSelect === true;
    const canAdvance = picks.length > 0;

    useEffect(() => { setPicks([]); }, [question.id]);

    const togglePick = (opt: string) => {
        if (isMulti) {
            setPicks((prev) => prev.includes(opt) ? prev.filter((p) => p !== opt) : [...prev, opt]);
        } else {
            setPicks((prev) => prev.length === 1 && prev[0] === opt ? [] : [opt]);
        }
    };

    const onAdvance = () => {
        if (!canAdvance) return;
        onAnswer(picks.join("、"));
    };

    const count = Math.min(question.quickPicks.length, 6);
    const positions = QUICK_PICK_POSITIONS[count] ?? QUICK_PICK_POSITIONS[3];

    let hint = "";
    if (picks.length > 0) {
        hint = isMulti ? `已选 ${picks.length} 项，可继续添加或点继续` : "点击继续确认";
    }

    return (
        <>
            <header className={styles.header}>
                <h1 className={styles.title}>{question.question}</h1>
                <p className={styles.subtitle}>
                    {isMulti ? "可多选，点击继续确认" : "点一下快速回答"}
                </p>
            </header>
            <section className={styles.sky} aria-label="自适应问题">
                {question.quickPicks.slice(0, count).map((opt, i) => {
                    const [x, y] = positions[i] ?? [50, 50];
                    const isPicked = picks.includes(opt);
                    return (
                        <button
                            key={opt}
                            type="button"
                            className={`${styles.star} ${isPicked ? styles.picked : ""}`}
                            style={{ left: `${x}%`, top: `${y}%`, "--dot": "8px" } as CSSProperties}
                            onClick={() => togglePick(opt)}
                            aria-pressed={isPicked}
                            aria-label={opt}
                        >
                            <span className={styles.starDot} aria-hidden />
                            <span className={`${styles.starLabel} ${styles.adaptiveLabel}`}>{opt}</span>
                        </button>
                    );
                })}
            </section>
            <footer className={styles.footer}>
                <p className={styles.hint}>{hint}</p>
                <div className={styles.footerActions}>
                    {canUndo ? (
                        <button type="button" className={styles.undoBtn} onClick={onUndo}>
                            ← 上一步
                        </button>
                    ) : null}
                    <button
                        type="button"
                        className={styles.advance}
                        disabled={!canAdvance}
                        onClick={onAdvance}
                    >
                        继续
                    </button>
                </div>
            </footer>
        </>
    );
}

// ---------------------------------------------------------------------------
// ResolveView — pre-readout conflict picker
// ---------------------------------------------------------------------------

interface ResolveViewProps {
    readonly question: ResolveQuestion;
    readonly setLedger: React.Dispatch<React.SetStateAction<KnowledgeLedger>>;
}

function ResolveView({ question, setLedger }: ResolveViewProps) {
    const onPick = (idx: number) => {
        setLedger((l) => resolveConflict(l, question.field, idx === 0 ? -1 : idx - 1));
    };

    return (
        <>
            <header className={styles.header}>
                <h1 className={styles.title}>有处需要你来定夺</h1>
                <p className={styles.subtitle}>
                    {`关于「${question.fieldLabel}」,我们听到了两种说法,挑一个为准`}
                </p>
            </header>
            <section className={styles.sky} aria-label="conflict picker">
                <div className={styles.resolveCard}>
                    {question.options.map((o, i) => (
                        <button
                            key={i}
                            type="button"
                            className={styles.resolveOption}
                            onClick={() => onPick(i)}
                        >
                            <span className={styles.resolveValue}>{o.label}</span>
                            <span className={styles.resolveSource}>{sourceLabel(o.source)}</span>
                        </button>
                    ))}
                </div>
            </section>
            <footer className={styles.footer}>
                <p className={styles.hint}>选一个继续,另一个会被记到备注里</p>
            </footer>
        </>
    );
}

function sourceLabel(s: Source): string {
    return (
        ({
            star: "刚刚星图选的",
            assessment: "问卷里测出来的",
            upload: "材料里看到的",
            wish: "你自己写的",
        } as Record<Source, string>)[s] ?? s
    );
}

// ---------------------------------------------------------------------------
// PickerSky
// ---------------------------------------------------------------------------

interface PickerSkyProps {
    readonly night: PickerNight;
    readonly current: ReadonlyArray<string>;
    readonly onToggle: (starId: string) => void;
    /** Star IDs to visually highlight (from Holland/RIASEC). */
    readonly hollandHighlights?: Set<string>;
}

function PickerSky({ night, current, onToggle, hollandHighlights }: PickerSkyProps) {
    const linePoints = useMemo(() => {
        const map = new Map(night.stars.map((s) => [s.id, s]));
        const seq = current.map((id) => map.get(id)).filter((s): s is NonNullable<typeof s> => Boolean(s));
        if (seq.length < 2) return null;
        return seq.map((s, idx) => `${idx === 0 ? "M" : "L"} ${s.x} ${s.y}`).join(" ");
    }, [current, night.stars]);

    return (
        <section className={styles.sky} aria-label={night.title}>
            {linePoints ? (
                <svg
                    className={styles.lines}
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    aria-hidden
                >
                    <path
                        className={styles.line}
                        key={current.join("-")}
                        d={linePoints}
                        vectorEffect="non-scaling-stroke"
                    />
                </svg>
            ) : null}

            {night.stars.map((s) => {
                const isPicked = current.includes(s.id);
                const isHighlighted = hollandHighlights?.has(s.id) ?? false;
                const dot = (s.mag ?? 1) === 3 ? 11 : (s.mag ?? 1) === 2 ? 9 : 7;
                const style = {
                    left: `${s.x}%`,
                    top: `${s.y}%`,
                    "--dot": `${dot}px`,
                } as CSSProperties;
                return (
                    <button
                        type="button"
                        key={s.id}
                        className={`${styles.star} ${isPicked ? styles.picked : ""} ${isHighlighted ? styles.highlighted : ""}`}
                        style={style}
                        aria-pressed={isPicked}
                        aria-label={`${s.label}${isHighlighted ? " (推荐)" : ""}`}
                        onClick={() => onToggle(s.id)}
                    >
                        <span className={styles.starDot} aria-hidden />
                        <span className={styles.starLabel}>{s.label}</span>
                    </button>
                );
            })}
        </section>
    );
}

// ---------------------------------------------------------------------------
// DecorativeAstrolabe — animation only, no free-form search input
// ---------------------------------------------------------------------------

function DecorativeAstrolabe() {
    return (
        <div className={styles.wishStage} aria-hidden="true">
            <div className={styles.wishAstrolabe} style={{ pointerEvents: "none" }}>
                <svg className={styles.wishAstrolabeSvg} viewBox="-110 -110 220 220" aria-hidden="true">
                    <circle r="100" className={styles.wishRingOuter} />
                    <circle r="78" className={styles.wishRingMid} />
                    <circle r="54" className={styles.wishRingInner} />
                    <circle r="3" className={styles.wishCore} />
                    {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => {
                        const rad = (deg * Math.PI) / 180;
                        const x1 = Math.cos(rad) * 96;
                        const y1 = Math.sin(rad) * 96;
                        const x2 = Math.cos(rad) * 82;
                        const y2 = Math.sin(rad) * 82;
                        return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} className={styles.wishTick} />;
                    })}
                </svg>
                <span className={styles.wishAstrolabeLabel}>自由感知</span>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// HollandRecommendCard — floating panel on field picker showing top RIASEC matches
// ---------------------------------------------------------------------------

interface HollandRecommendCardProps {
    readonly stars: ReadonlyArray<StarDef>;
    readonly highlights: Set<string>;
}

function HollandRecommendCard({ stars, highlights }: HollandRecommendCardProps) {
    // The Set's insertion order matches the score ranking from computeTopHollandFields.
    const labels = [...highlights]
        .map((id) => stars.find((s) => s.id === id)?.label)
        .filter((l): l is string => l !== undefined)
        .slice(0, 3);
    if (labels.length === 0) return null;
    return (
        <div className={styles.hollandCard}>
            <p className={styles.hollandCardTitle}>根据你的测评结果</p>
            <p className={styles.hollandCardSub}>较为契合的方向</p>
            <ul className={styles.hollandCardList}>
                {labels.map((label) => (
                    <li key={label} className={styles.hollandCardItem}>
                        <span className={styles.hollandCardDot} aria-hidden />
                        {label}
                    </li>
                ))}
            </ul>
        </div>
    );
}

// ---------------------------------------------------------------------------
// ReadoutView
// ---------------------------------------------------------------------------

interface ReadoutViewProps {
    readonly loading: boolean;
    readonly diagnosis: StarDiagnosis | null;
    readonly error: string | null;
    readonly ledger: KnowledgeLedger;
    readonly onFinalize: () => void;
    readonly onRetry: () => void;
}

const AUTO_FINALIZE_SECONDS = 15;

function ReadoutView({ loading, diagnosis, error, ledger, onFinalize, onRetry }: ReadoutViewProps) {
    const profile = buildProfileSummary(ledger);
    const [countdown, setCountdown] = useState(AUTO_FINALIZE_SECONDS);
    const finalizeRef = useRef(onFinalize);
    finalizeRef.current = onFinalize;

    // Auto-trigger once diagnosis is ready and we're not already loading.
    useEffect(() => {
        if (!diagnosis || loading) return;
        setCountdown(AUTO_FINALIZE_SECONDS);
        const interval = setInterval(() => {
            setCountdown((n) => {
                if (n <= 1) {
                    clearInterval(interval);
                    finalizeRef.current();
                    return 0;
                }
                return n - 1;
            });
        }, 1000);
        return () => clearInterval(interval);
    // Only restart when diagnosis first appears — not on every loading change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [diagnosis]);

    return (
        <section className={styles.readout} aria-live="polite">
            <div className={styles.readoutInner}>
                <div className={styles.nightLabel}>READOUT</div>
                <h1 className={styles.readoutTitle}>你的星图</h1>

                {profile.length > 0 ? (
                    <div className={styles.profileGrid}>
                        {profile.map(({ label, value, faint }) => (
                            <div key={label} className={`${styles.profileCard} ${faint ? styles.profileCardFaint : ""}`}>
                                <span className={styles.profileCardLabel}>{label}</span>
                                <span className={styles.profileCardValue}>{value}</span>
                            </div>
                        ))}
                    </div>
                ) : null}

                <div className={styles.readoutDivider} aria-hidden />

                {loading ? (
                    <p className={styles.readoutLoading}>正在分析你的星图……</p>
                ) : null}

                {error && !diagnosis ? (
                    <div className={styles.readoutErrorRow}>
                        <p className={styles.readoutError}>{error}</p>
                        <button type="button" className={styles.advance} onClick={onRetry}>重试</button>
                    </div>
                ) : null}

                {diagnosis ? (
                    <>
                        <p className={styles.readoutPara}>
                            <span className={styles.readoutLabel}>综合画像</span>
                            {diagnosis.portrait}
                        </p>
                        <p className={styles.readoutPara}>
                            <span className={styles.readoutLabel}>关键权衡</span>
                            {diagnosis.tradeoffs}
                        </p>
                    </>
                ) : null}

                <div className={styles.readoutActions}>
                    <button type="button" className={styles.advance} disabled={loading} onClick={() => { setCountdown(0); onFinalize(); }}>
                        {diagnosis && countdown > 0
                            ? `生成院校方案（${countdown}s）`
                            : loading
                                ? "生成中…"
                                : "生成院校方案"}
                    </button>
                </div>
            </div>
        </section>
    );
}
