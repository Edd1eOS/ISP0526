import type { Country } from "@isp0526/core";

export interface PyramidCard {
    readonly programId: string;
    readonly tier: "stretch" | "match" | "safety";
    readonly score: number;
    readonly universityName: string;
    readonly programName: string;
    readonly country: Country | undefined;
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

// The pyramid is laid out top-down: 2 stretch -> 3 match -> 1 safety, with
// thin down-arrows between rows to encode priority flow.
export function Pyramid({ cards }: PyramidProps) {
    const rows: ReadonlyArray<{
        readonly tier: PyramidCard["tier"];
        readonly items: readonly PyramidCard[];
    }> = [
        {
            tier: "stretch",
            items: cards.filter((c) => c.tier === "stretch"),
        },
        { tier: "match", items: cards.filter((c) => c.tier === "match") },
        { tier: "safety", items: cards.filter((c) => c.tier === "safety") },
    ];

    return (
        <div className="space-y-3">
            {rows.map((row, rowIdx) => (
                <div key={row.tier} className="space-y-3">
                    <div
                        className="grid gap-3"
                        style={{
                            gridTemplateColumns: `repeat(${row.items.length}, minmax(0, 1fr))`,
                            // Center the row visually by capping its width
                            // relative to the tier size; 2-up and 1-up rows
                            // pull in narrower so the pyramid silhouette is
                            // visible.
                            maxWidth:
                                row.items.length === 1
                                    ? "32%"
                                    : row.items.length === 2
                                      ? "66%"
                                      : "100%",
                            margin: "0 auto",
                        }}
                    >
                        {row.items.map((c) => (
                            <article
                                key={c.programId}
                                className="space-y-1 px-4 py-3"
                                style={{
                                    background: "var(--gradient-raised)",
                                    borderRadius: "var(--radius-card)",
                                    boxShadow: "var(--shadow-clay-card)",
                                    borderTop: `4px solid transparent`,
                                    borderImage: `${TIER_ACCENT[c.tier]} 1`,
                                }}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <span
                                        className="px-2 py-0.5 text-[10px] font-bold text-white"
                                        style={{
                                            background: TIER_ACCENT[c.tier],
                                            borderRadius: "999px",
                                        }}
                                    >
                                        {TIER_LABEL[c.tier]}
                                    </span>
                                    <span className="text-text text-sm font-bold">
                                        {c.score}
                                    </span>
                                </div>
                                <h3 className="text-text text-sm font-semibold leading-tight">
                                    {c.universityName}
                                </h3>
                                <p className="text-text-muted text-xs leading-snug">
                                    {c.programName}
                                </p>
                                {c.country ? (
                                    <p className="text-text-muted text-[10px]">
                                        {c.country}
                                        {c.city ? ` · ${c.city}` : ""}
                                    </p>
                                ) : null}
                            </article>
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

function DownArrow() {
    return (
        <svg
            width="24"
            height="22"
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
