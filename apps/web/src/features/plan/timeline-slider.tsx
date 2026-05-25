"use client";

import { useMemo, useRef, useState } from "react";

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

const RAIL_HEIGHT = 10;
const THUMB_SIZE = 28;

export function TimelineSlider({ events, programNames }: TimelineSliderProps) {
    const sorted = useMemo(
        () =>
            [...events].sort(
                (a, b) => Date.parse(a.date) - Date.parse(b.date),
            ),
        [events],
    );

    const [idx, setIdx] = useState(0);
    const hoverIdx: number | null = null;
    // Continuous drag position in [0, 1] while the user is dragging. When
    // not dragging this is null and the thumb is rendered from `idx`.
    const [dragPct, setDragPct] = useState<number | null>(null);
    const dragging = dragPct !== null;
    const railRef = useRef<HTMLDivElement>(null);
    const pointerIdRef = useRef<number | null>(null);

    // Compute the snap targets in [0,1] from event dates so dragging snaps to
    // the actual milestone positions instead of the index midpoints.
    const snapTargets = useMemo(() => {
        if (sorted.length === 0) return [] as number[];
        const min = Date.parse(sorted[0]!.date);
        const max = Date.parse(sorted[sorted.length - 1]!.date);
        const span = Math.max(1, max - min);
        return sorted.map((ev) => (Date.parse(ev.date) - min) / span);
    }, [sorted]);

    if (sorted.length === 0) {
        return (
            <p className="text-text-muted text-sm">暂无时间节点数据。</p>
        );
    }

    const safeIdx = Math.min(idx, sorted.length - 1);
    const active = sorted[safeIdx]!;
    const activePct = snapTargets[safeIdx] ?? 0;
    const displayPct = dragPct ?? activePct;
    const revealedIdx =
        hoverIdx ?? (dragging ? nearestIdx(dragPct ?? 0, snapTargets) : safeIdx);

    function pctFromClientX(clientX: number): number {
        const rail = railRef.current;
        if (!rail) return 0;
        const rect = rail.getBoundingClientRect();
        const raw = (clientX - rect.left) / Math.max(1, rect.width);
        return Math.max(0, Math.min(1, raw));
    }

    function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
        const pct = pctFromClientX(e.clientX);
        setDragPct(pct);
        pointerIdRef.current = e.pointerId;
        (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    }
    function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
        if (pointerIdRef.current === null) return;
        setDragPct(pctFromClientX(e.clientX));
    }
    function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
        if (pointerIdRef.current === null) return;
        const finalPct = pctFromClientX(e.clientX);
        const next = nearestIdx(finalPct, snapTargets);
        setIdx(next);
        setDragPct(null);
        pointerIdRef.current = null;
        (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
    }

    function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
        if (e.key === "ArrowLeft" && safeIdx > 0) {
            setIdx(safeIdx - 1);
            e.preventDefault();
        } else if (e.key === "ArrowRight" && safeIdx < sorted.length - 1) {
            setIdx(safeIdx + 1);
            e.preventDefault();
        }
    }

    return (
        <div className="space-y-4">
            {/* Rail container - pointer area is the full strip so the thumb
                stays easy to grab. */}
            <div
                className="relative cursor-pointer touch-none select-none"
                style={{ height: 96, paddingTop: 36, paddingBottom: 24 }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onKeyDown={onKeyDown}
                role="slider"
                aria-valuemin={0}
                aria-valuemax={sorted.length - 1}
                aria-valuenow={safeIdx}
                aria-valuetext={`${active.label} ${formatDate(active.date)}`}
                tabIndex={0}
            >
                <div ref={railRef} className="relative w-full" style={{ height: RAIL_HEIGHT }}>
                    {/* Background rail */}
                    <div
                        className="absolute inset-0"
                        style={{
                            background: "var(--color-surface-alt)",
                            borderRadius: 999,
                            boxShadow:
                                "inset 0 1px 3px rgba(0,0,0,0.08)",
                        }}
                    />
                    {/* Filled progress */}
                    <div
                        className={
                            dragging
                                ? "absolute left-0 top-0 h-full"
                                : "absolute left-0 top-0 h-full transition-[width] duration-500 ease-out"
                        }
                        style={{
                            width: `${displayPct * 100}%`,
                            background: "var(--gradient-primary)",
                            borderRadius: 999,
                        }}
                    />
                    {/* Tick markers */}
                    {sorted.map((ev, i) => {
                        const pct = snapTargets[i]! * 100;
                        const isActive = i === safeIdx;
                        const isRevealed = i === revealedIdx;
                        const size = isActive
                            ? 14
                            : isRevealed
                                ? 12
                                : 8;
                        return (
                            <span
                                key={ev.key}
                                aria-hidden="true"
                                className="pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2 transition-[width,height,background,box-shadow] duration-200 ease-out"
                                style={{
                                    left: `${pct}%`,
                                    width: size,
                                    height: size,
                                    borderRadius: 999,
                                    background: isActive
                                        ? "#fff"
                                        : isRevealed
                                            ? "var(--gradient-raised)"
                                            : "rgba(255,255,255,0.85)",
                                    boxShadow: isActive
                                        ? "0 0 0 2px rgba(0,0,0,0.04), var(--shadow-clay-card)"
                                        : isRevealed
                                            ? "var(--shadow-clay-card)"
                                            : "0 1px 2px rgba(0,0,0,0.1)",
                                }}
                            />
                        );
                    })}
                    {/* Thumb */}
                    <div
                        className={
                            dragging
                                ? "pointer-events-none absolute top-1/2"
                                : "pointer-events-none absolute top-1/2 transition-[left] duration-500 ease-out"
                        }
                        style={{
                            left: `${displayPct * 100}%`,
                            transform: `translate(-50%, -50%) scale(${dragging ? 1.15 : 1})`,
                            transition: dragging
                                ? "transform 120ms ease-out"
                                : "left 500ms cubic-bezier(0.22, 1, 0.36, 1), transform 200ms ease-out",
                            width: THUMB_SIZE,
                            height: THUMB_SIZE,
                            borderRadius: 999,
                            background: "var(--gradient-primary)",
                            boxShadow:
                                "var(--shadow-clay-raised), 0 0 0 4px rgba(255,255,255,0.5)",
                        }}
                    />
                    {/* Hover / drag tooltip above the thumb */}
                    <span
                        aria-hidden="true"
                        className="pointer-events-none absolute -translate-x-1/2 whitespace-nowrap text-[11px] font-semibold tabular-nums transition-[opacity,transform] duration-150 ease-out"
                        style={{
                            left: `${(dragging ? displayPct : (snapTargets[revealedIdx] ?? 0)) * 100}%`,
                            bottom: 22,
                            opacity: dragging || hoverIdx !== null || true ? 1 : 0,
                            padding: "4px 10px",
                            background: "var(--gradient-raised)",
                            boxShadow: "var(--shadow-clay-card)",
                            borderRadius: 10,
                            color: "var(--color-text, #1f2937)",
                        }}
                    >
                        {dragging
                            ? shortDate(sorted[nearestIdx(displayPct, snapTargets)]!.date)
                            : formatDate(sorted[revealedIdx]!.date)}
                    </span>
                </div>
            </div>

            {/* Active event card */}
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
                        {dragging
                            ? sorted[nearestIdx(displayPct, snapTargets)]!.label
                            : active.label}
                    </span>
                    <span className="text-text-muted text-xs tabular-nums">
                        {formatDate(
                            dragging
                                ? sorted[nearestIdx(displayPct, snapTargets)]!.date
                                : active.date,
                        )}
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

function nearestIdx(pct: number, targets: readonly number[]): number {
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < targets.length; i += 1) {
        const d = Math.abs(targets[i]! - pct);
        if (d < bestDist) {
            bestDist = d;
            best = i;
        }
    }
    return best;
}

