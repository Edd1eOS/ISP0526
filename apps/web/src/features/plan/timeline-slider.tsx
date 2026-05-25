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
    return `${d.getUTCFullYear()}/${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

function monthLabel(iso: string): string {
    const d = new Date(iso + "T00:00:00Z");
    return `${d.getUTCMonth() + 1}月`;
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

    if (sorted.length === 0) {
        return (
            <p className="text-text-muted text-sm">暂无时间节点数据。</p>
        );
    }

    const active = sorted[idx]!;
    const minT = Date.parse(sorted[0]!.date);
    const maxT = Date.parse(sorted[sorted.length - 1]!.date);
    const span = Math.max(1, maxT - minT);

    return (
        <div className="space-y-4">
            <div className="relative h-14">
                <div
                    className="absolute left-0 right-0 top-7 h-1"
                    style={{
                        background: "var(--color-surface-alt)",
                        borderRadius: "999px",
                    }}
                />
                {sorted.map((ev, i) => {
                    const pct = ((Date.parse(ev.date) - minT) / span) * 100;
                    const isActive = i === idx;
                    return (
                        <button
                            key={ev.key}
                            type="button"
                            onClick={() => setIdx(i)}
                            aria-label={ev.label}
                            className="absolute -translate-x-1/2 transition-transform active:scale-95"
                            style={{
                                top: 18,
                                left: `${pct}%`,
                            }}
                        >
                            <span
                                className="block h-5 w-5"
                                style={{
                                    background: isActive
                                        ? "var(--gradient-primary)"
                                        : "var(--gradient-raised)",
                                    boxShadow: isActive
                                        ? "var(--shadow-clay-raised)"
                                        : "var(--shadow-clay-card)",
                                    borderRadius: "999px",
                                }}
                            />
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

            <div
                className="space-y-2 px-4 py-3"
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
                    <span className="text-text-muted text-xs">
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

            <ol className="grid gap-1.5 sm:grid-cols-2">
                {sorted.map((ev, i) => {
                    const isActive = i === idx;
                    return (
                        <li key={ev.key}>
                            <button
                                type="button"
                                onClick={() => setIdx(i)}
                                className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-xs transition-transform active:scale-[0.99]"
                                style={{
                                    background: isActive
                                        ? "var(--gradient-primary)"
                                        : "var(--color-surface-alt)",
                                    color: isActive ? "#fff" : undefined,
                                    borderRadius: "var(--radius-button)",
                                    fontWeight: isActive ? 600 : 400,
                                }}
                            >
                                <span>{ev.label}</span>
                                <span className="opacity-80">
                                    {monthLabel(ev.date)}
                                </span>
                            </button>
                        </li>
                    );
                })}
            </ol>
        </div>
    );
}
