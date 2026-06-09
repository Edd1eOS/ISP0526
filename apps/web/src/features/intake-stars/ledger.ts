// KnowledgeLedger — the single source of truth across all intake
// inputs (assessment, upload, star picks, free-form wish text). The
// star chart consumes this ledger via the QuestionEngine; conflicts
// between sources are stored but NOT revealed mid-flow — they get
// resolved as their own question type just before the readout.

import type { Country } from "@isp0526/core";
import type { ClarifyPatch } from "../intake-clarify/clarify-schema";
import type { FieldGroup } from "./types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Source = "assessment" | "upload" | "star" | "wish";

export interface FactAlternative<T> {
    readonly value: T;
    readonly source: Source;
    readonly confidence?: number;
}

export interface FactCell<T> {
    readonly value: T;
    readonly source: Source;
    readonly confidence?: number;
    /** True only after the student has been shown and accepted the
     *  implications of this fact (via a confirm question). */
    readonly confirmed: boolean;
    /** Differing values picked up from other sources. Empty when no
     *  conflict. */
    readonly alternatives: ReadonlyArray<FactAlternative<T>>;
}

export type TargetLevel =
    | "foundation"
    | "pathway"
    | "diploma"
    | "bachelor"
    | "master"
    | "phd";
export type TeachingStyle = "theory_heavy" | "balanced" | "applied_heavy";
export type CitySize = "mega" | "large" | "medium" | "small";
export type Tag =
    | "field_top"
    | "migration_friendly"
    | "career_pipeline"
    | "value_for_money"
    | "scholarship_rich"
    | "chinese_community";

export interface LedgerFacts {
    field_group?: FactCell<FieldGroup>;
    target_level?: FactCell<TargetLevel>;
    target_field?: FactCell<string>;
    gpa?: FactCell<number>;
    ielts_overall?: FactCell<number>;
    annual_budget_aud?: FactCell<number>;
    teaching_style?: FactCell<TeachingStyle>;
    city_size?: FactCell<CitySize>;
    preferred_tags?: FactCell<ReadonlyArray<Tag>>;
    preferred_countries?: FactCell<ReadonlyArray<Country>>;
}

/** Confirmation status for an implication topic.
 *   - true  : student acknowledged
 *   - false : student rejected on first show (we treat the fact as soft)
 *   - null  : asked twice, still unclear; treated as skipped/blank
 *   - undefined : not yet asked
 */
export type ConfirmStatus = true | false | null | undefined;

export interface LedgerConfirmations {
    field_implications?: ConfirmStatus;
    city_implications?: ConfirmStatus;
    budget_implications?: ConfirmStatus;
}

export interface ConversationTurn {
    /** Unique ID for this adaptive question (e.g. "adaptive_0"). */
    readonly qid: string;
    /** The question text the LLM generated. */
    readonly question: string;
    /** The student's answer (quick-pick label or free-form text). */
    readonly answer: string;
}

export interface KnowledgeLedger {
    readonly facts: LedgerFacts;
    readonly confirmations: LedgerConfirmations;
    /** Per-question contextual text. Keys are Question.id. */
    readonly wishes: Readonly<Record<string, string>>;
    /** Legacy free notes not bound to any question. */
    readonly freeNotes: string;
    /** Supplementary picker IDs whose selected labels should be treated as
     *  contextual text. Used by the engine's wishedSkip check. */
    readonly committedWishes: ReadonlyArray<string>;
    /** Ordered Q&A turns from the adaptive (LLM-generated) question phase.
     *  Passed as context to subsequent question generation and to diagnosis. */
    readonly conversationHistory: ReadonlyArray<ConversationTurn>;
    /** Count of adaptive main questions asked so far (not counting fixed pickers).
     *  The LLM uses this to know when to stop (max ~7 to stay under 10 total). */
    readonly adaptiveQuestionCount: number;
}

// ---------------------------------------------------------------------------
// Constructors and helpers
// ---------------------------------------------------------------------------

export function emptyLedger(): KnowledgeLedger {
    return {
        facts: {},
        confirmations: {},
        wishes: {},
        freeNotes: "",
        committedWishes: [],
        conversationHistory: [],
        adaptiveQuestionCount: 0,
    };
}

/** Append a completed adaptive Q&A turn to the ledger. */
export function appendConversationTurn(
    l: KnowledgeLedger,
    turn: ConversationTurn,
): KnowledgeLedger {
    return {
        ...l,
        conversationHistory: [...l.conversationHistory, turn],
        adaptiveQuestionCount: l.adaptiveQuestionCount + 1,
    };
}

/** Mark a supplementary picker as answered via contextual text so the engine
 *  skips it after the user clicks "继续". */
export function commitWish(
    l: KnowledgeLedger,
    questionId: string,
): KnowledgeLedger {
    if ((l.committedWishes ?? []).includes(questionId)) return l;
    return { ...l, committedWishes: [...(l.committedWishes ?? []), questionId] };
}

/** Update or insert a fact cell. First write wins for the primary value;
 *  conflicting later writes go into alternatives. Matching value re-writes
 *  upgrade the source if the new source has higher authority.
 *
 *  Source priority (high to low): star > assessment > upload > wish.
 *  Star and assessment are direct user actions; upload is LLM-extracted
 *  with confidence; wish is unstructured. */
function updateCell<T>(
    existing: FactCell<T> | undefined,
    value: T,
    source: Source,
    confidence: number | undefined,
    equals: (a: T, b: T) => boolean,
): FactCell<T> {
    if (!existing) {
        return {
            value,
            source,
            ...(confidence != null ? { confidence } : {}),
            confirmed: false,
            alternatives: [],
        };
    }
    if (equals(existing.value, value)) {
        // Same value: upgrade source priority if new is more authoritative.
        if (sourcePriority(source) > sourcePriority(existing.source)) {
            return {
                ...existing,
                source,
                ...(confidence != null
                    ? { confidence }
                    : existing.confidence != null
                        ? { confidence: existing.confidence }
                        : {}),
            };
        }
        return existing;
    }
    // Differing value: keep primary, append to alternatives if not present.
    const already = existing.alternatives.some((a) => equals(a.value, value));
    if (already) return existing;
    const next: FactAlternative<T> = {
        value,
        source,
        ...(confidence != null ? { confidence } : {}),
    };
    return { ...existing, alternatives: [...existing.alternatives, next] };
}

function sourcePriority(s: Source): number {
    switch (s) {
        case "star":
            return 4;
        case "assessment":
            return 3;
        case "upload":
            return 2;
        case "wish":
            return 1;
    }
}

const eqScalar = <T,>(a: T, b: T): boolean => a === b;
const eqTags = (a: ReadonlyArray<Tag>, b: ReadonlyArray<Tag>): boolean => {
    if (a.length !== b.length) return false;
    const sa = [...a].sort();
    const sb = [...b].sort();
    return sa.every((v, i) => v === sb[i]);
};

// ---------------------------------------------------------------------------
// mergeFact — field-typed update returning a new ledger.
// ---------------------------------------------------------------------------

export interface MergeInput {
    readonly source: Source;
    readonly confidence?: number;
}

export function mergeTargetLevel(
    l: KnowledgeLedger,
    v: TargetLevel,
    opt: MergeInput,
): KnowledgeLedger {
    return {
        ...l,
        facts: {
            ...l.facts,
            target_level: updateCell(
                l.facts.target_level,
                v,
                opt.source,
                opt.confidence,
                eqScalar,
            ),
        },
    };
}

export function mergeFieldGroup(
    l: KnowledgeLedger,
    v: FieldGroup,
    opt: MergeInput,
): KnowledgeLedger {
    return {
        ...l,
        facts: {
            ...l.facts,
            field_group: updateCell(
                l.facts.field_group,
                v,
                opt.source,
                opt.confidence,
                eqScalar,
            ),
        },
    };
}

export function mergeTargetField(
    l: KnowledgeLedger,
    v: string,
    opt: MergeInput,
): KnowledgeLedger {
    return {
        ...l,
        facts: {
            ...l.facts,
            target_field: updateCell(
                l.facts.target_field,
                v,
                opt.source,
                opt.confidence,
                eqScalar,
            ),
        },
    };
}

export function mergeGpa(
    l: KnowledgeLedger,
    v: number,
    opt: MergeInput,
): KnowledgeLedger {
    return {
        ...l,
        facts: {
            ...l.facts,
            gpa: updateCell(l.facts.gpa, v, opt.source, opt.confidence, eqScalar),
        },
    };
}

export function mergeIelts(
    l: KnowledgeLedger,
    v: number,
    opt: MergeInput,
): KnowledgeLedger {
    return {
        ...l,
        facts: {
            ...l.facts,
            ielts_overall: updateCell(
                l.facts.ielts_overall,
                v,
                opt.source,
                opt.confidence,
                eqScalar,
            ),
        },
    };
}

export function mergeBudget(
    l: KnowledgeLedger,
    v: number,
    opt: MergeInput,
): KnowledgeLedger {
    return {
        ...l,
        facts: {
            ...l.facts,
            annual_budget_aud: updateCell(
                l.facts.annual_budget_aud,
                v,
                opt.source,
                opt.confidence,
                eqScalar,
            ),
        },
    };
}

export function mergeTeachingStyle(
    l: KnowledgeLedger,
    v: TeachingStyle,
    opt: MergeInput,
): KnowledgeLedger {
    return {
        ...l,
        facts: {
            ...l.facts,
            teaching_style: updateCell(
                l.facts.teaching_style,
                v,
                opt.source,
                opt.confidence,
                eqScalar,
            ),
        },
    };
}

export function mergeCitySize(
    l: KnowledgeLedger,
    v: CitySize,
    opt: MergeInput,
): KnowledgeLedger {
    return {
        ...l,
        facts: {
            ...l.facts,
            city_size: updateCell(
                l.facts.city_size,
                v,
                opt.source,
                opt.confidence,
                eqScalar,
            ),
        },
    };
}

export function mergeTags(
    l: KnowledgeLedger,
    v: ReadonlyArray<Tag>,
    opt: MergeInput,
): KnowledgeLedger {
    // Tags are multi-pick; conflicts are not meaningful per-element. If a
    // primary exists, union the new tags into the primary and skip the
    // alternatives lane.
    const existing = l.facts.preferred_tags;
    if (!existing) {
        return {
            ...l,
            facts: {
                ...l.facts,
                preferred_tags: {
                    value: v,
                    source: opt.source,
                    ...(opt.confidence != null
                        ? { confidence: opt.confidence }
                        : {}),
                    confirmed: false,
                    alternatives: [],
                },
            },
        };
    }
    const merged: Tag[] = [...existing.value];
    for (const t of v) if (!merged.includes(t)) merged.push(t);
    if (eqTags(existing.value, merged)) return l;
    return {
        ...l,
        facts: {
            ...l.facts,
            preferred_tags: { ...existing, value: merged },
        },
    };
}

export function mergeCountries(
    l: KnowledgeLedger,
    v: ReadonlyArray<Country>,
    opt: MergeInput,
): KnowledgeLedger {
    // Countries are multi-pick; union new values into the primary cell.
    const existing = l.facts.preferred_countries;
    if (!existing) {
        return {
            ...l,
            facts: {
                ...l.facts,
                preferred_countries: {
                    value: v,
                    source: opt.source,
                    ...(opt.confidence != null ? { confidence: opt.confidence } : {}),
                    confirmed: false,
                    alternatives: [],
                },
            },
        };
    }
    const merged: Country[] = [...existing.value];
    for (const c of v) if (!merged.includes(c)) merged.push(c);
    if (merged.length === existing.value.length) return l;
    return {
        ...l,
        facts: {
            ...l.facts,
            preferred_countries: { ...existing, value: merged },
        },
    };
}

// ---------------------------------------------------------------------------
// Confirmation + wish writers
// ---------------------------------------------------------------------------

export function setConfirmation(
    l: KnowledgeLedger,
    topic: keyof LedgerConfirmations,
    status: ConfirmStatus,
): KnowledgeLedger {
    return { ...l, confirmations: { ...l.confirmations, [topic]: status } };
}

/** Mark a fact's `confirmed` flag (used when implication question for the
 *  same topic was accepted). */
export function markFactConfirmed(
    l: KnowledgeLedger,
    field: keyof LedgerFacts,
): KnowledgeLedger {
    const cell = l.facts[field];
    if (!cell) return l;
    return {
        ...l,
        facts: { ...l.facts, [field]: { ...cell, confirmed: true } },
    };
}

/** Resolve a conflict by promoting one of the alternatives to primary
 *  (or keeping current). Alternatives is cleared afterward. */
export function resolveConflict<K extends keyof LedgerFacts>(
    l: KnowledgeLedger,
    field: K,
    pickIndex: number, // -1 keeps current, 0..n picks from alternatives
): KnowledgeLedger {
    const cell = l.facts[field];
    if (!cell) return l;
    if (pickIndex < 0) {
        return {
            ...l,
            facts: { ...l.facts, [field]: { ...cell, alternatives: [] } },
        };
    }
    const alt = cell.alternatives[pickIndex];
    if (!alt) return l;
    const next = {
        ...cell,
        value: alt.value,
        source: alt.source,
        ...(alt.confidence != null
            ? { confidence: alt.confidence }
            : { confidence: undefined }),
        alternatives: [],
    };
    return { ...l, facts: { ...l.facts, [field]: next } };
}

/** Remove a fact entirely so the engine will re-ask that question.
 *  Clears both the primary value and any accumulated alternatives. */
export function clearFact(
    l: KnowledgeLedger,
    field: keyof LedgerFacts,
): KnowledgeLedger {
    const facts = { ...l.facts };
    delete facts[field];
    return { ...l, facts };
}

export function setWish(
    l: KnowledgeLedger,
    questionId: string,
    text: string,
): KnowledgeLedger {
    const trimmed = text.slice(0, 600);
    if (!trimmed) {
        // delete key
        const next = { ...l.wishes };
        delete next[questionId];
        return { ...l, wishes: next };
    }
    return { ...l, wishes: { ...l.wishes, [questionId]: trimmed } };
}

export function setFreeNotes(
    l: KnowledgeLedger,
    text: string,
): KnowledgeLedger {
    return { ...l, freeNotes: text.slice(0, 1200) };
}

// ---------------------------------------------------------------------------
// Projection back to ClarifyPatch
// ---------------------------------------------------------------------------

export function ledgerToClarifyPatch(l: KnowledgeLedger): ClarifyPatch {
    const f = l.facts;
    const out: ClarifyPatch = {};
    if (f.target_level) out.target_level = f.target_level.value;
    if (f.target_field) out.target_field = f.target_field.value;
    if (f.gpa != null && f.gpa) out.gpa = f.gpa.value;
    if (f.ielts_overall != null && f.ielts_overall)
        out.ielts_overall = f.ielts_overall.value;
    if (f.annual_budget_aud) out.annual_budget_aud = f.annual_budget_aud.value;
    if (f.teaching_style) out.teaching_style = f.teaching_style.value;
    if (f.city_size) out.city_size = f.city_size.value;
    if (f.preferred_tags && f.preferred_tags.value.length > 0) {
        out.preferred_tags = [...f.preferred_tags.value];
    }
    if (f.preferred_countries && f.preferred_countries.value.length > 0) {
        out.preferred_countries = [...f.preferred_countries.value];
    }
    return out;
}

// ---------------------------------------------------------------------------
// Conflict detection
// ---------------------------------------------------------------------------

export interface FactConflict {
    readonly field: keyof LedgerFacts;
    readonly primaryValue: unknown;
    readonly primarySource: Source;
    readonly alternatives: ReadonlyArray<FactAlternative<unknown>>;
}

export function listConflicts(l: KnowledgeLedger): ReadonlyArray<FactConflict> {
    const out: FactConflict[] = [];
    const keys: Array<keyof LedgerFacts> = [
        "target_level",
        "target_field",
        "gpa",
        "ielts_overall",
        "annual_budget_aud",
        "teaching_style",
        "city_size",
    ];
    for (const k of keys) {
        const cell = l.facts[k];
        if (cell && cell.alternatives.length > 0) {
            out.push({
                field: k,
                primaryValue: cell.value,
                primarySource: cell.source,
                alternatives: cell.alternatives as ReadonlyArray<
                    FactAlternative<unknown>
                >,
            });
        }
    }
    return out;
}
