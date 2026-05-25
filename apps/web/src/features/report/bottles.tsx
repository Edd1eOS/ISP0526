"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ScoreBreakdown } from "@isp0526/core";

export interface BottleCard {
    readonly programId: string;
    readonly headline: string;
    readonly scoreInt: number;
    readonly flagKey: keyof ScoreBreakdown;
    readonly flagLabel: string;
    readonly flagBg: string;
    readonly flagFg: string;
    readonly country: string | undefined;
    readonly city: string | undefined;
    readonly summary: string | undefined;
    readonly pros: ReadonlyArray<{ readonly text: string; readonly sourceId: string }>;
    readonly breakdown: ScoreBreakdown;
    readonly source: "llm" | "template" | undefined;
}

export interface BottleSection {
    readonly key: "match" | "stretch" | "safety";
    readonly title: string;
    readonly accent: string;
    readonly cards: ReadonlyArray<BottleCard>;
}

const DIMENSION_LABEL: Record<keyof ScoreBreakdown, string> = {
    academic_fit: "学术契合",
    personality: "性格",
    lifestyle: "生活",
    career: "就业",
    budget: "预算",
    tag_boost: "标签",
    reputation: "口碑",
    visa_feasibility: "签证",
};

export function BottlesGrid({ sections }: { sections: ReadonlyArray<BottleSection> }) {
    // Local order state per bottle so capsules can be dragged to reorder
    // within a bottle. The server-side scoring still determines tier
    // assignment — drag-reorder is purely cosmetic.
    const [orders, setOrders] = useState<Record<string, ReadonlyArray<string>>>(
        () => {
            const init: Record<string, ReadonlyArray<string>> = {};
            for (const s of sections) {
                init[s.key] = s.cards.map((c) => c.programId);
            }
            return init;
        },
    );

    const [openCardId, setOpenCardId] = useState<string | null>(null);
    const dialogRef = useRef<HTMLDialogElement | null>(null);

    useEffect(() => {
        const dlg = dialogRef.current;
        if (!dlg) return;
        if (openCardId && !dlg.open) dlg.showModal();
        if (!openCardId && dlg.open) dlg.close();
    }, [openCardId]);

    const allCards = useMemo(() => {
        const map = new Map<string, BottleCard>();
        for (const s of sections) {
            for (const c of s.cards) map.set(c.programId, c);
        }
        return map;
    }, [sections]);

    const openCard = openCardId ? allCards.get(openCardId) : null;

    const reorder = useCallback(
        (bottleKey: string, fromId: string, toId: string) => {
            if (fromId === toId) return;
            setOrders((prev) => {
                const cur = prev[bottleKey];
                if (!cur) return prev;
                const fromIdx = cur.indexOf(fromId);
                const toIdx = cur.indexOf(toId);
                if (fromIdx < 0 || toIdx < 0) return prev;
                const next = cur.slice();
                next.splice(fromIdx, 1);
                next.splice(toIdx, 0, fromId);
                return { ...prev, [bottleKey]: next };
            });
        },
        [],
    );

    return (
        <>
            <div className="grid gap-6 lg:grid-cols-3">
                {sections.map((section) => (
                    <Bottle
                        key={section.key}
                        section={section}
                        order={orders[section.key] ?? section.cards.map((c) => c.programId)}
                        onReorder={(from, to) => reorder(section.key, from, to)}
                        onOpen={(id) => setOpenCardId(id)}
                    />
                ))}
            </div>

            <dialog
                ref={dialogRef}
                onClose={() => setOpenCardId(null)}
                onClick={(e) => {
                    // Click on backdrop closes the dialog.
                    if (e.target === dialogRef.current) setOpenCardId(null);
                }}
                className="w-full max-w-2xl bg-transparent p-0 backdrop:bg-black/40 backdrop:backdrop-blur-sm"
            >
                {openCard ? (
                    <CardDetailPanel
                        card={openCard}
                        onClose={() => setOpenCardId(null)}
                    />
                ) : null}
            </dialog>
        </>
    );
}

function Bottle({
    section,
    order,
    onReorder,
    onOpen,
}: {
    section: BottleSection;
    order: ReadonlyArray<string>;
    onReorder: (fromId: string, toId: string) => void;
    onOpen: (id: string) => void;
}) {
    const cardMap = useMemo(() => {
        const m = new Map<string, BottleCard>();
        for (const c of section.cards) m.set(c.programId, c);
        return m;
    }, [section.cards]);

    const orderedCards = order
        .map((id) => cardMap.get(id))
        .filter((c): c is BottleCard => c !== undefined);

    const [dragOverId, setDragOverId] = useState<string | null>(null);

    return (
        <section className="relative flex flex-col items-center pt-6">
            {/* Bottle cap */}
            <div
                className="text-text relative z-10 -mb-2 px-4 py-1.5 text-xs font-semibold tracking-wide"
                style={{
                    background: section.accent,
                    borderRadius: "12px 12px 4px 4px",
                    boxShadow: "var(--shadow-clay-raised)",
                }}
            >
                {section.title}
                <span className="text-text-muted ml-2 font-normal">
                    {section.cards.length}
                </span>
            </div>

            {/* Bottle body */}
            <div
                className="relative w-full overflow-hidden px-3 pb-5 pt-6"
                style={{
                    background:
                        "linear-gradient(180deg, rgba(255,255,255,0.65) 0%, var(--color-surface-alt) 100%)",
                    borderRadius: "28px 28px 36px 36px / 18px 18px 48px 48px",
                    boxShadow:
                        "inset 0 2px 6px rgba(255,255,255,0.6), inset 0 -8px 18px rgba(0,0,0,0.06), var(--shadow-clay-card)",
                    minHeight: 320,
                }}
                aria-label={`${section.title} 瓶`}
            >
                {orderedCards.length === 0 ? (
                    <p className="text-text-muted py-10 text-center text-sm">
                        这一档暂时没有匹配。
                    </p>
                ) : (
                    <ul className="flex flex-col gap-2" role="list">
                        {orderedCards.map((card) => (
                            <li
                                key={card.programId}
                                draggable
                                onDragStart={(e) => {
                                    e.dataTransfer.setData("text/plain", card.programId);
                                    e.dataTransfer.effectAllowed = "move";
                                }}
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    e.dataTransfer.dropEffect = "move";
                                    setDragOverId(card.programId);
                                }}
                                onDragLeave={() => setDragOverId((v) => (v === card.programId ? null : v))}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    const fromId = e.dataTransfer.getData("text/plain");
                                    if (fromId) onReorder(fromId, card.programId);
                                    setDragOverId(null);
                                }}
                                onDragEnd={() => setDragOverId(null)}
                                className="transition-transform"
                                style={{
                                    transform: dragOverId === card.programId ? "scale(1.02)" : undefined,
                                }}
                            >
                                <button
                                    type="button"
                                    onClick={() => onOpen(card.programId)}
                                    className="bg-surface flex w-full cursor-grab items-center gap-2 rounded-full px-3 py-2 text-left active:cursor-grabbing"
                                    style={{ boxShadow: "var(--shadow-clay-raised)" }}
                                    aria-label={`${card.headline} · ${card.flagLabel} · 综合 ${card.scoreInt}`}
                                >
                                    <span
                                        className="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
                                        style={{ background: card.flagBg, color: card.flagFg }}
                                        title={`综合 ${card.scoreInt} · 突出维度：${DIMENSION_LABEL[card.flagKey]}`}
                                    >
                                        {card.flagLabel}
                                    </span>
                                    <span className="text-text min-w-0 flex-1 truncate text-xs font-medium sm:text-sm">
                                        {card.headline}
                                    </span>
                                    <span
                                        aria-hidden
                                        className="text-text-muted shrink-0 text-[10px]"
                                        title="可拖拽排序"
                                    >
                                        ⋮⋮
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </section>
    );
}

function CardDetailPanel({
    card,
    onClose,
}: {
    card: BottleCard;
    onClose: () => void;
}) {
    return (
        <div
            className="bg-surface relative space-y-4 px-6 py-6"
            style={{
                borderRadius: "var(--radius-card-md)",
                boxShadow: "var(--shadow-clay-card)",
            }}
        >
            <button
                type="button"
                onClick={onClose}
                aria-label="关闭"
                className="text-text-muted hover:text-text absolute right-3 top-3 h-7 w-7 rounded-full text-sm"
                style={{ background: "var(--color-surface-alt)" }}
            >
                ×
            </button>

            <div className="flex flex-wrap items-center gap-2">
                <span
                    className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
                    style={{ background: card.flagBg, color: card.flagFg }}
                >
                    {card.flagLabel}
                </span>
                {card.source ? (
                    <span
                        className="text-text-muted rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider"
                        style={{ background: "var(--color-surface-alt)" }}
                        title={
                            card.source === "llm"
                                ? "本条推荐文案由 Gemini 2.0 Flash 生成，并经 Zod 校验 + 来源过滤"
                                : "本条推荐文案由模板渲染（LLM 未启用或已回退）"
                        }
                    >
                        {card.source === "llm" ? "AI" : "模板"}
                    </span>
                ) : null}
            </div>

            <div className="space-y-1">
                <h3 className="text-text text-lg font-semibold leading-snug">
                    {card.headline}
                </h3>
                <div className="text-text-muted flex flex-wrap items-center gap-2 text-xs">
                    {card.country ? (
                        <span
                            className="rounded-full px-2 py-0.5 font-medium"
                            style={{ background: "var(--color-surface-alt)" }}
                        >
                            {card.country}
                            {card.city ? ` · ${card.city}` : ""}
                        </span>
                    ) : null}
                    <span
                        className="rounded-full px-2 py-0.5 font-medium"
                        style={{ background: "var(--color-surface-alt)" }}
                    >
                        综合 {card.scoreInt}
                    </span>
                </div>
            </div>

            {card.summary ? (
                <p className="text-text-muted text-sm leading-relaxed">
                    {card.summary}
                </p>
            ) : null}

            {card.pros.length > 0 ? (
                <ul className="space-y-1.5 text-sm">
                    {card.pros.map((p, i) => (
                        <li key={i} className="text-text flex gap-2">
                            <span aria-hidden className="text-accent">·</span>
                            <span>
                                {p.text}
                                <span className="text-text-muted ml-1 text-xs">
                                    ({p.sourceId})
                                </span>
                            </span>
                        </li>
                    ))}
                </ul>
            ) : null}

            <div className="border-t pt-3" style={{ borderColor: "var(--color-surface-alt)" }}>
                <h4 className="text-text mb-2 text-sm font-semibold">维度分解</h4>
                <BreakdownRadar breakdown={card.breakdown} />
            </div>
        </div>
    );
}

function BreakdownRadar({ breakdown }: { breakdown: ScoreBreakdown }) {
    const entries = (Object.keys(DIMENSION_LABEL) as (keyof ScoreBreakdown)[]).map(
        (k) => ({ key: k, label: DIMENSION_LABEL[k], value: breakdown[k] }),
    );
    const n = entries.length;
    const cx = 110;
    const cy = 110;
    const radius = 80;
    const polar = (i: number, r: number) => {
        const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
        return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)] as const;
    };
    const gridLevels = [0.25, 0.5, 0.75, 1];
    const gridPaths = gridLevels.map((lvl) =>
        entries
            .map((_, i) => polar(i, radius * lvl))
            .map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`)
            .join(" "),
    );
    const valuePoints = entries
        .map((e, i) => polar(i, radius * Math.max(0.05, e.value)))
        .map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`)
        .join(" ");

    return (
        <div className="text-text-muted text-xs">
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
                <svg
                    viewBox="0 0 220 220"
                    className="h-48 w-48 shrink-0"
                    role="img"
                    aria-label="dimension radar"
                >
                    {gridPaths.map((pts, idx) => (
                        <polygon
                            key={idx}
                            points={pts}
                            fill="none"
                            stroke="currentColor"
                            strokeOpacity={0.15}
                        />
                    ))}
                    <polygon
                        points={valuePoints}
                        fill="var(--color-accent)"
                        fillOpacity={0.25}
                        stroke="var(--color-accent)"
                        strokeWidth={1.5}
                    />
                    {entries.map((e, i) => {
                        const [x, y] = polar(i, radius + 14);
                        return (
                            <text
                                key={e.key}
                                x={x}
                                y={y}
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fontSize={10}
                                fill="currentColor"
                            >
                                {e.label}
                            </text>
                        );
                    })}
                </svg>
                <ul className="grid w-full grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    {entries.map((e) => (
                        <li key={e.key} className="flex justify-between">
                            <span>{e.label}</span>
                            <span>{Math.round(e.value * 100)}</span>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}
