// Pure helpers for the chat-intake flow. Two responsibilities:
//
// 1. Slot locking — once a field has a concrete value in `accumulated`, the
//    chat layer should NEVER ask for it again and should drop any LLM patch
//    attempt to overwrite it. This fixes the "我不是说了吗" bug where the
//    LLM kept re-asking target_field after the student answered.
//
// 2. Phase / FSM — explicit four-phase progression so the system prompt can
//    inject phase-specific guidance instead of one big bag of rules. The
//    LLM "writes the line", the FSM "owns the state".
//
// These helpers are intentionally pure (no I/O, no LLM calls) so both the
// server action and the client can call them without coupling.

import {
    FORM_FIELD_KEYS,
    type ClarifyPatch,
    type FormFieldKey,
} from "../intake-clarify/clarify-schema";

export type IntakePhase =
    | "OPENING"
    | "GATHERING_CORE"
    | "GATHERING_SOFT"
    | "READY_TO_RECOMMEND";

const CORE_FIELDS: ReadonlyArray<FormFieldKey> = [
    "target_level",
    "target_field",
];

// A field is considered "filled" (locked) when accumulated carries a real
// value for it OR the student explicitly skipped it. Empty strings, empty
// arrays, and undefined all count as not filled.
export function isFieldFilled(
    p: ClarifyPatch,
    key: FormFieldKey,
): boolean {
    const skipped = new Set(p.skipped_fields ?? []);
    if (skipped.has(key)) return true;
    if (
        key === "gpa" &&
        p.credentials &&
        p.credentials.length > 0
    ) {
        // Any volunteered credential satisfies the gpa slot.
        return true;
    }
    const v = (p as Record<string, unknown>)[key];
    if (v === undefined || v === null) return false;
    if (Array.isArray(v) && v.length === 0) return false;
    if (typeof v === "string" && v.trim() === "") return false;
    return true;
}

// Returns the subset of form-field keys that already have a concrete value
// in the accumulated patch. These keys are "locked": prompt must not ask
// for them again, and patch-merge must drop any overwrite attempt.
export function lockedKeys(p: ClarifyPatch): ReadonlyArray<FormFieldKey> {
    return FORM_FIELD_KEYS.filter((k) => isFieldFilled(p, k));
}

export function unlockedKeys(p: ClarifyPatch): ReadonlyArray<FormFieldKey> {
    return FORM_FIELD_KEYS.filter((k) => !isFieldFilled(p, k));
}

// Phase rules:
//   OPENING            — no user message yet (handled at call-site)
//   GATHERING_CORE     — any of target_level / target_field / budget unfilled
//   GATHERING_SOFT     — all core filled, but extra signals still useful
//   READY_TO_RECOMMEND — core + >=3 supporting signals (matches existing
//                        canFinalize threshold), or student already said stop
export function nextPhase(
    p: ClarifyPatch,
    opts: { hasUserMessage: boolean } = { hasUserMessage: true },
): IntakePhase {
    if (!opts.hasUserMessage) return "OPENING";
    const coreFilled = CORE_FIELDS.every((k) => isFieldFilled(p, k));
    if (!coreFilled) return "GATHERING_CORE";
    const signalCount = supportingSignalCount(p);
    if (signalCount >= 3) return "READY_TO_RECOMMEND";
    return "GATHERING_SOFT";
}

function supportingSignalCount(p: ClarifyPatch): number {
    let n = 0;
    for (const k of FORM_FIELD_KEYS) {
        if (k === "target_level") continue;
        if (isFieldFilled(p, k)) n += 1;
    }
    return n;
}

// Drop any patch entries that try to overwrite a locked field, and strip
// any keys outside the known FormFieldKey whitelist (the schema already
// drops them, but doing it here gives us a clean object to log/return).
//
// `credentials` is special-cased: it is allowed even after gpa is locked,
// because a student can volunteer extra transcripts at any point.
export function sanitizePatch(
    base: ClarifyPatch,
    incoming: ClarifyPatch | undefined,
): ClarifyPatch | undefined {
    if (!incoming) return undefined;
    const locked = new Set(lockedKeys(base));
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(incoming)) {
        if (k === "skipped_fields" || k === "credentials") {
            out[k] = v;
            continue;
        }
        if (!(FORM_FIELD_KEYS as ReadonlyArray<string>).includes(k)) {
            // Unknown top-level key — drop silently.
            continue;
        }
        if (locked.has(k as FormFieldKey)) {
            // Locked: ignore LLM overwrite attempts.
            continue;
        }
        out[k] = v;
    }
    return out as ClarifyPatch;
}

// Deep-merge a sanitized incoming patch into the accumulated base. Arrays
// (preferred_tags, skipped_fields, credentials) are unioned by identity so
// neither side loses prior entries.
export function mergePatchDeep(
    base: ClarifyPatch,
    next: ClarifyPatch | undefined,
): ClarifyPatch {
    if (!next) return base;
    const merged: ClarifyPatch = { ...base, ...next };

    if (base.skipped_fields || next.skipped_fields) {
        const set = new Set<FormFieldKey>([
            ...(base.skipped_fields ?? []),
            ...(next.skipped_fields ?? []),
        ]);
        merged.skipped_fields = [...set];
    }

    if (base.preferred_tags || next.preferred_tags) {
        const set = new Set<string>([
            ...(base.preferred_tags ?? []),
            ...(next.preferred_tags ?? []),
        ]);
        merged.preferred_tags =
            set.size > 0
                ? ([...set] as ClarifyPatch["preferred_tags"])
                : merged.preferred_tags;
    }

    if (base.credentials || next.credentials) {
        const seen = new Set<string>();
        const all = [
            ...(base.credentials ?? []),
            ...(next.credentials ?? []),
        ];
        const unique = all.filter((c) => {
            const key = `${c.kind}|${c.raw}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
        merged.credentials = unique;
    }

    return merged;
}
