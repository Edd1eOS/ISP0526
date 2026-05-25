"use client";

import { useMemo, useState } from "react";

export interface TimelineEvent {
    readonly key: string;
    readonly label: string;
    readonly date: string; // ISO YYYY-MM-DD
    readonly programIds: readonly string[];
    readonly note?: string;
}

export interface TimelineSliderProps {
    readonly events: readonly TimelineEvent[];
    readonly programNames: Readonly<Record<string, string>>;
}

function formatDate(iso: string): string {
    const d = new Date(iso + "T00:00:00Z");
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}/${m}/${day}`;
}

function shortDate(iso: string): string {
    const d = new Date(iso + "T00:00:00Z");
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${m}/${day}`;
}

export function TimelineSlider({ events, programNames }: TimelineSliderProps) {
    const sorted = useMemo(
        () =>
            [...events].sort(
                (a, b) => Date.parse(a.date) - Date.parse(b.date),
            ),
        [events],
    );
    const [idx, setIdx] = useState(0);
    const [hoverIdx, setHoverIdx] = useState<number | null>(null);

    if (sorted.length === 0) {
        return (
            <p className="text-text-muted text-sm">暂无时间节点数据。</p>
        );
    }

    const active = sorted[idx]!;
    const minT = Date.parse(sorted[0]!.date);
    const maxT = Date.parse(sorted[sorted.length - 1]!.date);
    const span = Math.max(1, maxT - minT);
    const activePct = ((Date.parse(active.date) - minT) / span) * 100;
    const revealedIdx = hoverIdx ?? idx;

    return (
        <div className="space-y-4">
            {/* Rail with dots. Dates only show on the active / hovered node. */}
            <div className="relative h-20">
                {/* Background rail */}
                <div
                    className="absolute left-0 right-0"
                    style={{
                        top: 44,
                        height: 4,
                        background: "var(--color-surface-alt)",
                        borderRadius: 999,
                    }}
                />
                {/* Progress rail up to the active node, animated */}
                <div
                    className="absolute left-0 transition-[width] duration-500 ease-out"
                    style={{
                        top: 44,
                        height: 4,
                        width: `${activePct}%`,
                        background: "var(--gradient-primary)",
                        borderRadius: 999,
                    }}
                />
                {sorted.map((ev, i) => {
                    const pct = ((Date.parse(ev.date) - minT) / span) * 100;
                    const isActive = i === idx;
                    const isRevealed = i === revealedIdx;
                    const size = isActive ? 22 : isRevealed ? 18 : 12;
                    return (
                        <button
                            key={ev.key}
                            type="button"
                            onClick={() => setIdx(i)}
                            onMouseEnter={() => setHoverIdx(i)}
                            onMouseLeave={() => setHoverIdx(null)}
                            onFocus={() => setHoverIdx(i)}
                            onBlur={() => setHoverIdx(null)}
                            aria-label={`${ev.label} ${formatDate(ev.date)}`}
                            className="absolute -translate-x-1/2 outline-none"
                            style={{
                                top: 44 - size / 2 + 2,
                                left: `${pct}%`,
                                width: 28,
                                height: 28,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <span
                                aria-hidden="true"
                                className="transition-[width,height,box-shadow,background] duration-300 ease-out"
                                style={{
                                    width: size,
                                    height: size,
                                    borderRadius: 999,
                                    background: isActive
                                        ? "var(--gradient-primary)"
                                        : isRevealed
                                            ? "var(--gradient-raised)"
                                            : "var(--color-surface-alt)",
                                    boxShadow: isActive
                                        ? "var(--shadow-clay-raised)"
                                        : isRevealed
                                            ? "var(--shadow-clay-card)"
                                            : "none",
                                }}
                            />
                            {/* Date tooltip — only render for the revealed node */}
                            <span
                                aria-hidden="true"
                                className="pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold tabular-nums transition-[opacity,transform] duration-200 ease-out"
                                style={{
                                    bottom: 36,
                                    opacity: isRevealed ? 1 : 0,
                                    transform: isRevealed
                                        ? "translate(-50%, 0)"
                                        : "translate(-50%, 4px)",
                                    padding: "4px 8px",
                                    background: "var(--gradient-raised)",
                                    boxShadow: "var(--shadow-clay-card)",
                                    borderRadius: 8,
                                    color: "var(--color-text, #1f2937)",
                                }}
                            >
                                {isActive
                                    ? formatDate(ev.date)
                                    : shortDate(ev.date)}
                            </span>
                        </button>
                    );
                })}
            </div>

            <input
                type="range"
                min={0}
                max={sorted.length - 1}
                step={1}
                value={idx}
                onChange={(e) => setIdx(Number(e.target.value))}
                className="w-full"
                aria-label="时间轴滑块"
            />

            {/* Active event card. Crossfades on change. */}
            <div
                key={active.key}
                className="space-y-2 px-4 py-3 animate-[fadeIn_280ms_ease-out]"
                style={{
                    background: "var(--gradient-raised)",
                    borderRadius: "var(--radius-card)",
                    boxShadow: "var(--shadow-clay-card)",
                }}
            >
                <div className="flex items-baseline justify-between gap-2">
                    <span className="text-text text-base font-semibold">
                        {active.label}
                    </span>
                    <span className="text-text-muted text-xs tabular-nums">
                        {formatDate(active.date)}
                    </span>
                </div>
                {active.note ? (
                    <p className="text-text-muted text-xs">{active.note}</p>
                ) : null}
                {active.programIds.length > 0 ? (
                    <ul className="flex flex-wrap gap-1.5">
                        {active.programIds.map((pid) => (
                            <li
                                key={pid}
                                className="text-text px-2 py-0.5 text-xs"
                                style={{
                                    background: "var(--color-surface-alt)",
                                    borderRadius: "999px",
                                }}
                            >
                                {programNames[pid] ?? pid}
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-text-muted text-xs">适用所有已选项目</p>
                )}
            </div>

            <style jsx>{`
                @keyframes fadeIn {
                    from {
                        opacity: 0;
                        transform: translateY(4px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
            `}</style>
        </div>
    );
}
