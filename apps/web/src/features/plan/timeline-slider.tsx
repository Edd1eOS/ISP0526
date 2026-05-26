"use client";

import { useMemo, useRef, useState } from "react";

export type TimelineEventKind =
    | "application_open"
    | "application_deadline"
    | "decision_by"
    | "deposit_deadline"
    | "visa_window"
    | "intake_start";

export interface TimelineEvent {
    readonly key: string;
    readonly label: string;
    readonly date: string; // ISO YYYY-MM-DD
    readonly programIds: readonly string[];
    readonly note?: string;
    readonly kind?: TimelineEventKind;
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
            <div className="flex items-center gap-3">
                <StepButton
                    direction="prev"
                    disabled={safeIdx <= 0}
                    onClick={() => setIdx(Math.max(0, safeIdx - 1))}
                />
                {/* Rail container - pointer area is the full strip so the thumb
                    stays easy to grab. */}
                <div
                    className="relative flex-1 cursor-pointer touch-none select-none"
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
                        {/* Per-tick category icons rendered just above the rail */}
                        {sorted.map((ev, i) => {
                            const pct = snapTargets[i]! * 100;
                            const isActive = i === safeIdx;
                            return (
                                <span
                                    key={`icon-${ev.key}`}
                                    aria-hidden="true"
                                    className="pointer-events-none absolute -translate-x-1/2 transition-[opacity,transform,box-shadow] duration-200 ease-out"
                                    style={{
                                        left: `${pct}%`,
                                        bottom: RAIL_HEIGHT + 6,
                                        opacity: isActive ? 0 : 0.85,
                                        width: 20,
                                        height: 20,
                                        borderRadius: 999,
                                        background: ev.kind
                                            ? EVENT_TINT[ev.kind]
                                            : "var(--color-surface-alt)",
                                        color: "var(--color-text, #1f2937)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        boxShadow:
                                            "0 1px 2px rgba(0,0,0,0.1)",
                                    }}
                                >
                                    <EventIcon kind={ev.kind ?? "application_deadline"} size={12} />
                                </span>
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
                <StepButton
                    direction="next"
                    disabled={safeIdx >= sorted.length - 1}
                    onClick={() =>
                        setIdx(Math.min(sorted.length - 1, safeIdx + 1))
                    }
                />
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
                <div className="flex items-center justify-between gap-2">
                    <span className="text-text flex items-center gap-2 text-base font-semibold">
                        <span
                            aria-hidden="true"
                            className="flex shrink-0 items-center justify-center"
                            style={{
                                width: 28,
                                height: 28,
                                borderRadius: 999,
                                background: "var(--color-surface-alt)",
                                color: "var(--color-text, #1f2937)",
                            }}
                        >
                            <EventIcon
                                kind={
                                    (dragging
                                        ? sorted[
                                            nearestIdx(displayPct, snapTargets)
                                        ]!.kind
                                        : active.kind) ?? "application_deadline"
                                }
                            />
                        </span>
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

function StepButton({
    direction,
    disabled,
    onClick,
}: {
    readonly direction: "prev" | "next";
    readonly disabled: boolean;
    readonly onClick: () => void;
}) {
    const isPrev = direction === "prev";
    return (
        <button
            type="button"
            aria-label={isPrev ? "上一个节点" : "下一个节点"}
            disabled={disabled}
            onClick={onClick}
            className="flex shrink-0 items-center justify-center transition-[transform,opacity,box-shadow] duration-200 ease-out hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            style={{
                width: 36,
                height: 36,
                borderRadius: 999,
                background: "var(--gradient-raised)",
                boxShadow: "var(--shadow-clay-raised)",
                color: "var(--color-text, #1f2937)",
            }}
        >
            <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                aria-hidden="true"
                style={{ transform: isPrev ? "rotate(180deg)" : undefined }}
            >
                <path
                    d="M4 2 L9 7 L4 12"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
        </button>
    );
}

const EVENT_TINT: Record<TimelineEventKind, string> = {
    application_open: "#fde9c8",
    application_deadline: "#fcd0a2",
    decision_by: "#ffe2bf",
    deposit_deadline: "#f6cda5",
    visa_window: "#ffd9b3",
    intake_start: "#f5b78a",
};

function EventIcon({
    kind,
    size = 14,
}: {
    readonly kind: TimelineEventKind;
    readonly size?: number;
}) {
    const stroke = "currentColor";
    const sw = 1.6;
    switch (kind) {
        case "intake_start":
            return (
                <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M3 3 H7 A1.5 1.5 0 0 1 8.5 4.5 V13 A1 1 0 0 0 7.5 12 H3 Z" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
                    <path d="M13 3 H9 A1.5 1.5 0 0 0 7.5 4.5 V13 A1 1 0 0 1 8.5 12 H13 Z" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
                </svg>
            );
        case "deposit_deadline":
            return (
                <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M8 2 V14" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
                    <path d="M11.5 4.5 H6.5 A2 2 0 0 0 6.5 8.5 H9.5 A2 2 0 0 1 9.5 12.5 H4.5" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            );
        case "application_open":
            return (
                <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <rect x="3.5" y="7.5" width="9" height="6" rx="1.2" stroke={stroke} strokeWidth={sw} />
                    <path d="M5.5 7.5 V5 A2.5 2.5 0 0 1 10.5 4" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
                </svg>
            );
        case "application_deadline":
            return (
                <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <rect x="2.5" y="4" width="11" height="9.5" rx="1.2" stroke={stroke} strokeWidth={sw} />
                    <path d="M2.5 7 H13.5" stroke={stroke} strokeWidth={sw} />
                    <path d="M5.5 2.5 V5 M10.5 2.5 V5" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
                </svg>
            );
        case "decision_by":
            return (
                <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <rect x="2" y="4" width="12" height="8.5" rx="1.2" stroke={stroke} strokeWidth={sw} />
                    <path d="M2.5 5 L8 9 L13.5 5" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
                </svg>
            );
        case "visa_window":
            return (
                <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <rect x="3" y="2.5" width="10" height="11" rx="1.2" stroke={stroke} strokeWidth={sw} />
                    <circle cx="8" cy="7" r="1.8" stroke={stroke} strokeWidth={sw} />
                    <path d="M5.5 11 H10.5" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
                </svg>
            );
    }
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

