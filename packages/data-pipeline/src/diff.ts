import type { Program, University } from "@isp0526/core";

export type DiffKind = "add" | "change" | "same" | "conflict";

export type DiffEntry<T extends { id: string }> = {
    id: string;
    kind: DiffKind;
    fields?: string[];
};

function fieldDiff<T extends Record<string, unknown>>(a: T, b: T): string[] {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    const changed: string[] = [];
    for (const k of keys) {
        if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) changed.push(k);
    }
    return changed;
}

export function diffById<T extends { id: string }>(
    production: readonly T[],
    draft: readonly T[],
): DiffEntry<T>[] {
    const prodMap = new Map(production.map((r) => [r.id, r]));
    const out: DiffEntry<T>[] = [];

    for (const d of draft) {
        const p = prodMap.get(d.id);
        if (!p) {
            out.push({ id: d.id, kind: "add" });
            continue;
        }
        const fields = fieldDiff(p as Record<string, unknown>, d as Record<string, unknown>);
        if (fields.length === 0) out.push({ id: d.id, kind: "same" });
        else out.push({ id: d.id, kind: "change", fields });
        prodMap.delete(d.id);
    }

    return out;
}

export function diffUniversities(production: readonly University[], draft: readonly University[]) {
    return diffById(production, draft);
}

export function diffPrograms(production: readonly Program[], draft: readonly Program[]) {
    return diffById(production, draft);
}

export function summarizeDiff(entries: DiffEntry<{ id: string }>[]) {
    return {
        add: entries.filter((e) => e.kind === "add").length,
        change: entries.filter((e) => e.kind === "change").length,
        same: entries.filter((e) => e.kind === "same").length,
        conflict: entries.filter((e) => e.kind === "conflict").length,
    };
}
