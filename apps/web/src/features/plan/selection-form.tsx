"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export interface PickableProgram {
    readonly programId: string;
    readonly tier: "stretch" | "match" | "safety";
    readonly score: number;
    readonly universityName: string;
    readonly programName: string;
    readonly country: string | undefined;
    readonly city: string | null;
    readonly headline: string | null;
}

interface SelectionFormProps {
    readonly code: string;
    readonly locale: string;
    readonly reach: readonly PickableProgram[];
    readonly match: readonly PickableProgram[];
    readonly safety: readonly PickableProgram[];
}

const TARGETS = {
    stretch: { count: 2, label: "冲", note: "梦校 / 高于稳态线" },
    match: { count: 3, label: "稳", note: "命中率较高" },
    safety: { count: 1, label: "保", note: "兜底拿 offer" },
} as const;

type Tier = keyof typeof TARGETS;

const TIER_ACCENT: Record<Tier, string> = {
    stretch: "linear-gradient(135deg, #fecaca 0%, #f87171 100%)",
    match: "linear-gradient(135deg, #fde68a 0%, #fbbf24 100%)",
    safety: "linear-gradient(135deg, #bbf7d0 0%, #34d399 100%)",
};

export function SelectionForm({
    code,
    locale,
    reach,
    match,
    safety,
}: SelectionFormProps) {
    const router = useRouter();
    const [picks, setPicks] = useState<Record<Tier, Set<string>>>({
        stretch: new Set(),
        match: new Set(),
        safety: new Set(),
    });

    const tiers: ReadonlyArray<{
        readonly tier: Tier;
        readonly items: readonly PickableProgram[];
    }> = useMemo(
        () => [
            { tier: "stretch", items: reach },
            { tier: "match", items: match },
            { tier: "safety", items: safety },
        ],
        [reach, match, safety],
    );

    function toggle(tier: Tier, programId: string) {
        setPicks((prev) => {
            const next = new Set(prev[tier]);
            if (next.has(programId)) {
                next.delete(programId);
            } else if (next.size < TARGETS[tier].count) {
                next.add(programId);
            }
            return { ...prev, [tier]: next };
        });
    }

    const remaining: Record<Tier, number> = {
        stretch: TARGETS.stretch.count - picks.stretch.size,
        match: TARGETS.match.count - picks.match.size,
        safety: TARGETS.safety.count - picks.safety.size,
    };
    const totalNeeded = remaining.stretch + remaining.match + remaining.safety;
    const ready = totalNeeded === 0;

    function submit() {
        if (!ready) return;
        const flat = [
            ...Array.from(picks.stretch).map((id) => `s:${id}`),
            ...Array.from(picks.match).map((id) => `m:${id}`),
            ...Array.from(picks.safety).map((id) => `f:${id}`),
        ].join(",");
        router.push(
            `/${locale}/r/${code}/plan?picks=${encodeURIComponent(flat)}`,
        );
    }

    return (
        <div className="space-y-6">
            <div
                className="sticky top-2 z-10 flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                style={{
                    background: "var(--gradient-raised)",
                    borderRadius: "var(--radius-card)",
                    boxShadow: "var(--shadow-clay-card)",
                }}
            >
                <div className="flex flex-wrap gap-2 text-xs">
                    {(Object.keys(TARGETS) as Tier[]).map((t) => (
                        <span
                            key={t}
                            className="text-text px-3 py-1 font-semibold"
                            style={{
                                background:
                                    remaining[t] === 0
                                        ? "var(--gradient-primary)"
                                        : "var(--color-surface-alt)",
                                color: remaining[t] === 0 ? "#fff" : undefined,
                                borderRadius: "999px",
                            }}
                        >
                            {TARGETS[t].label} {picks[t].size}/
                            {TARGETS[t].count}
                        </span>
                    ))}
                </div>
                <button
                    type="button"
                    disabled={!ready}
                    onClick={submit}
                    className="px-4 py-2 text-sm font-semibold text-white transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                    style={{
                        background: "var(--gradient-primary)",
                        borderRadius: "var(--radius-button)",
                        boxShadow: "var(--shadow-clay-raised)",
                    }}
                >
                    {ready ? "生成方案" : `再选 ${totalNeeded} 所`}
                </button>
            </div>

            {tiers.map(({ tier, items }) => (
                <section
                    key={tier}
                    className="space-y-3 px-4 py-4"
                    style={{
                        background: "var(--gradient-raised)",
                        borderRadius: "var(--radius-card)",
                        boxShadow: "var(--shadow-clay-card)",
                    }}
                >
                    <header className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span
                                className="inline-flex h-8 w-8 items-center justify-center text-sm font-bold text-white"
                                style={{
                                    background: TIER_ACCENT[tier],
                                    borderRadius: "999px",
                                }}
                            >
                                {TARGETS[tier].label}
                            </span>
                            <div>
                                <h2 className="text-text text-base font-semibold">
                                    {TARGETS[tier].label}{" "}
                                    <span className="text-text-muted text-xs font-normal">
                                        · 选 {TARGETS[tier].count} 所 ·{" "}
                                        {TARGETS[tier].note}
                                    </span>
                                </h2>
                            </div>
                        </div>
                        <span className="text-text-muted text-xs">
                            {picks[tier].size}/{TARGETS[tier].count}
                        </span>
                    </header>

                    <ul className="grid gap-2 sm:grid-cols-2">
                        {items.map((item) => {
                            const selected = picks[tier].has(item.programId);
                            const reachedCap =
                                !selected &&
                                picks[tier].size >= TARGETS[tier].count;
                            return (
                                <li key={item.programId}>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            toggle(tier, item.programId)
                                        }
                                        disabled={reachedCap}
                                        className="flex w-full flex-col items-start gap-1 px-4 py-3 text-left transition-transform active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                                        style={{
                                            background: selected
                                                ? "var(--gradient-primary)"
                                                : "var(--color-surface-alt)",
                                            color: selected
                                                ? "#fff"
                                                : undefined,
                                            borderRadius:
                                                "var(--radius-button)",
                                            boxShadow: selected
                                                ? "var(--shadow-clay-raised)"
                                                : "var(--shadow-clay-card)",
                                        }}
                                    >
                                        <div className="flex w-full items-center justify-between gap-2">
                                            <span className="text-sm font-semibold">
                                                {item.universityName}
                                            </span>
                                            <span className="text-xs font-bold">
                                                {item.score}
                                            </span>
                                        </div>
                                        <span className="text-xs opacity-80">
                                            {item.programName}
                                        </span>
                                        {item.country ? (
                                            <span className="text-xs opacity-70">
                                                {item.country}
                                                {item.city
                                                    ? ` · ${item.city}`
                                                    : ""}
                                            </span>
                                        ) : null}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </section>
            ))}
        </div>
    );
}
