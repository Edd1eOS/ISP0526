"use client";

import { useState } from "react";

export interface PyramidCard {
    readonly programId: string;
    readonly tier: "stretch" | "match" | "safety";
    readonly score: number;
    readonly universityName: string;
    readonly programName: string;
    readonly country: string | undefined;
    readonly city: string | null;
}

const TIER_LABEL: Record<PyramidCard["tier"], string> = {
    stretch: "冲",
    match: "稳",
    safety: "保",
};

const TIER_ACCENT: Record<PyramidCard["tier"], string> = {
    stretch: "linear-gradient(135deg, #fecaca 0%, #f87171 100%)",
    match: "linear-gradient(135deg, #fde68a 0%, #fbbf24 100%)",
    safety: "linear-gradient(135deg, #bbf7d0 0%, #34d399 100%)",
};

interface PyramidProps {
    readonly cards: readonly PyramidCard[];
}

// Compact accordion-style pyramid: each program is a small capsule that
// expands on click to reveal program/country details. Only one capsule is
// expanded at a time per pyramid.
export function Pyramid({ cards }: PyramidProps) {
    const [openId, setOpenId] = useState<string | null>(null);

    const rows: ReadonlyArray<{
        readonly tier: PyramidCard["tier"];
        readonly items: readonly PyramidCard[];
    }> = [
            { tier: "stretch", items: cards.filter((c) => c.tier === "stretch") },
            { tier: "match", items: cards.filter((c) => c.tier === "match") },
            { tier: "safety", items: cards.filter((c) => c.tier === "safety") },
        ];

    return (
        <div className="space-y-2">
            {rows.map((row, rowIdx) => (
                <div key={row.tier} className="space-y-2">
                    <div
                        className="flex flex-wrap justify-center gap-2"
                        style={{
                            maxWidth:
                                row.items.length === 1
                                    ? "40%"
                                    : row.items.length === 2
                                        ? "70%"
                                        : "100%",
                            margin: "0 auto",
                        }}
                    >
                        {row.items.map((c) => (
                            <Capsule
                                key={c.programId}
                                card={c}
                                open={openId === c.programId}
                                onToggle={() =>
                                    setOpenId((prev) =>
                                        prev === c.programId
                                            ? null
                                            : c.programId,
                                    )
                                }
                            />
                        ))}
                    </div>

                    {rowIdx < rows.length - 1 ? (
                        <div className="flex justify-center" aria-hidden="true">
                            <DownArrow />
                        </div>
                    ) : null}
                </div>
            ))}
        </div>
    );
}

interface CapsuleProps {
    readonly card: PyramidCard;
    readonly open: boolean;
    readonly onToggle: () => void;
}

function Capsule({ card, open, onToggle }: CapsuleProps) {
    return (
        <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            className="group flex flex-col items-stretch text-left transition-[transform,box-shadow] duration-200 ease-out active:scale-[0.98]"
            style={{
                background: "var(--gradient-raised)",
                borderRadius: 22,
                boxShadow: open
                    ? "var(--shadow-clay-raised)"
                    : "var(--shadow-clay-card)",
                paddingLeft: 14,
                paddingRight: 14,
                paddingTop: open ? 10 : 8,
                paddingBottom: open ? 12 : 8,
                minWidth: 180,
                maxWidth: 280,
                transform: open ? "translateY(-1px)" : undefined,
            }}
        >
            <div className="flex items-center gap-2">
                <span
                    aria-hidden="true"
                    style={{
                        width: 18,
                        height: 18,
                        borderRadius: "999px",
                        background: TIER_ACCENT[card.tier],
                        color: "#fff",
                        fontSize: 10,
                        fontWeight: 700,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                    }}
                >
                    {TIER_LABEL[card.tier]}
                </span>
                <span className="text-text flex-1 truncate text-xs font-semibold">
                    {card.universityName}
                </span>
                <span className="text-text-muted text-[11px] font-bold tabular-nums">
                    {card.score}
                </span>
            </div>
            <div
                className="overflow-hidden transition-[max-height,opacity,margin-top] duration-300 ease-out"
                style={{
                    maxHeight: open ? 80 : 0,
                    opacity: open ? 1 : 0,
                    marginTop: open ? 6 : 0,
                }}
            >
                <p className="text-text-muted text-[11px] leading-snug">
                    {card.programName}
                </p>
                {card.country ? (
                    <p className="text-text-muted text-[10px]">
                        {card.country}
                        {card.city ? ` · ${card.city}` : ""}
                    </p>
                ) : null}
            </div>
        </button>
    );
}

function DownArrow() {
    return (
        <svg
            width="20"
            height="18"
            viewBox="0 0 24 22"
            fill="none"
            stroke="var(--color-text-muted, #94a3b8)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M12 2v17" />
            <path d="M5 13l7 7 7-7" />
        </svg>
    );
}
