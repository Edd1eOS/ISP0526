"use client";

import { useEffect, useMemo, useState } from "react";
import type { PlanChecklist } from "@isp0526/core";

interface ChecklistFolderProps {
    readonly checklist: PlanChecklist | null;
    readonly error?: string;
    readonly programNames: Readonly<Record<string, string>>;
    readonly countries?: readonly string[];
}

type Priority = "high" | "medium" | "low";

interface CategoryMeta {
    readonly label: string;
    readonly priority: Priority;
    readonly accent: string;
    readonly bg: string;
    readonly chip: string;
    readonly chipText: string;
    readonly links: ReadonlyArray<{ readonly label: string; readonly url: string }>;
}

const VISA_LINKS: Record<string, { label: string; url: string }> = {
    UK: { label: "UK Student Visa · gov.uk", url: "https://www.gov.uk/student-visa" },
    US: { label: "US F-1 · travel.state.gov", url: "https://travel.state.gov/content/travel/en/us-visas/study/student-visa.html" },
    CA: { label: "CA Study Permit · IRCC", url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada.html" },
    AU: { label: "AU Subclass 500 · Home Affairs", url: "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/student-500" },
    NZ: { label: "NZ Student Visa · INZ", url: "https://www.immigration.govt.nz/new-zealand-visas/options/study" },
    HK: { label: "HK Study Entry · ImmD", url: "https://www.immd.gov.hk/eng/services/visas/study.html" },
    SG: { label: "SG Student Pass · ICA", url: "https://www.ica.gov.sg/enter-transit-depart/student-pass" },
    MY: { label: "MY Student Pass · Immigration", url: "https://www.imi.gov.my/index.php/en/main-services/pass/student-pass/?format=pdf" },
};

function buildCategoryMeta(countries: readonly string[]): Record<string, CategoryMeta> {
    const visaLinks = countries
        .map((c) => VISA_LINKS[c])
        .filter((x): x is { label: string; url: string } => !!x);
    return {
        visa: {
            label: "签证准备",
            priority: "high",
            accent: "#c2410c",
            bg: "#fff1e6",
            chip: "#fed7aa",
            chipText: "#7c2d12",
            links: visaLinks,
        },
        language: {
            label: "语言成绩",
            priority: "high",
            accent: "#b45309",
            bg: "#fff7ed",
            chip: "#fde68a",
            chipText: "#78350f",
            links: [
                { label: "IELTS 官方", url: "https://www.ielts.org/" },
                { label: "TOEFL · ETS", url: "https://www.ets.org/toefl" },
                { label: "PTE 官方", url: "https://www.pearsonpte.com/" },
            ],
        },
        academic: {
            label: "学术材料",
            priority: "medium",
            accent: "#9a3412",
            bg: "#fef5ec",
            chip: "#fbd5b5",
            chipText: "#7c2d12",
            links: [],
        },
        financial: {
            label: "资金证明",
            priority: "medium",
            accent: "#a16207",
            bg: "#fefaec",
            chip: "#fde68a",
            chipText: "#713f12",
            links: [],
        },
        personal: {
            label: "个人材料",
            priority: "low",
            accent: "#78716c",
            bg: "#fafaf9",
            chip: "#e7e5e4",
            chipText: "#44403c",
            links: [],
        },
        other: {
            label: "其他",
            priority: "low",
            accent: "#a8a29e",
            bg: "#fafaf9",
            chip: "#e7e5e4",
            chipText: "#57534e",
            links: [],
        },
    };
}

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
const PRIORITY_LABEL: Record<Priority, string> = {
    high: "优先",
    medium: "重要",
    low: "辅助",
};

export function ChecklistFolder({
    checklist,
    error,
    programNames,
    countries = [],
}: ChecklistFolderProps) {
    const [open, setOpen] = useState(false);
    const [cols, setCols] = useState(3);

    const meta = useMemo(() => buildCategoryMeta(countries), [countries]);

    const sections = useMemo(() => {
        if (!checklist) return [] as Array<{ cat: string; items: PlanChecklist["items"] }>;
        const grouped = new Map<string, PlanChecklist["items"]>();
        for (const it of checklist.items) {
            const list = grouped.get(it.category) ?? [];
            list.push(it);
            grouped.set(it.category, list);
        }
        return Array.from(grouped.entries())
            .map(([cat, items]) => ({ cat, items }))
            .sort((a, b) => {
                const ma = meta[a.cat]?.priority ?? "low";
                const mb = meta[b.cat]?.priority ?? "low";
                return PRIORITY_RANK[ma] - PRIORITY_RANK[mb];
            });
    }, [checklist, meta]);

    // Distribute sections into N balanced columns using Longest-Processing-Time
    // packing so each column ends with similar visual weight and full sections
    // never need to wrap across columns.
    const columns = useMemo(() => {
        const buckets: Array<{ items: typeof sections; weight: number }> = [];
        for (let i = 0; i < cols; i += 1) buckets.push({ items: [], weight: 0 });
        // Heuristic weight per section: header(1.2) + item count + link block(0.6 if links).
        const weighted = sections
            .map((s) => ({
                section: s,
                weight:
                    1.2 +
                    s.items.length +
                    ((meta[s.cat]?.links.length ?? 0) > 0 ? 0.6 : 0),
            }))
            .sort((a, b) => b.weight - a.weight);
        for (const w of weighted) {
            // Pick the lightest bucket; ties go to the leftmost so high-priority
            // (already sorted first) lands in column 1 when possible.
            let target = 0;
            for (let i = 1; i < buckets.length; i += 1) {
                if (buckets[i]!.weight < buckets[target]!.weight) target = i;
            }
            buckets[target]!.items.push(w.section);
            buckets[target]!.weight += w.weight;
        }
        // Restore priority order inside each column.
        for (const b of buckets) {
            b.items.sort((a, b) => {
                const ma = meta[a.cat]?.priority ?? "low";
                const mb = meta[b.cat]?.priority ?? "low";
                return PRIORITY_RANK[ma] - PRIORITY_RANK[mb];
            });
        }
        return buckets.map((b) => b.items);
    }, [sections, cols, meta]);

    const itemCount = checklist?.items.length ?? 0;

    // Track column count via matchMedia so LPT packing matches the rendered grid.
    useEffect(() => {
        const mqLg = window.matchMedia("(min-width: 1024px)");
        const mqMd = window.matchMedia("(min-width: 640px)");
        function update() {
            setCols(mqLg.matches ? 3 : mqMd.matches ? 2 : 1);
        }
        update();
        mqLg.addEventListener("change", update);
        mqMd.addEventListener("change", update);
        return () => {
            mqLg.removeEventListener("change", update);
            mqMd.removeEventListener("change", update);
        };
    }, []);

    // Close on Escape and lock body scroll while the floating panel is open.
    useEffect(() => {
        if (!open) return;
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape") setOpen(false);
        }
        window.addEventListener("keydown", onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            window.removeEventListener("keydown", onKey);
            document.body.style.overflow = prev;
        };
    }, [open]);

    return (
        <div className="space-y-3">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-transform active:scale-[0.99]"
                style={{
                    background: "var(--gradient-raised)",
                    borderRadius: "var(--radius-card)",
                    boxShadow: "var(--shadow-clay-card)",
                }}
                aria-expanded={open}
                aria-haspopup="dialog"
            >
                <span className="flex items-center gap-3">
                    <FolderIcon />
                    <span className="flex flex-col">
                        <span className="text-text text-sm font-semibold">
                            资料清单
                        </span>
                        <span className="text-text-muted text-xs">
                            {error
                                ? "AI 暂时不可用，可联系顾问"
                                : checklist
                                    ? `${itemCount} 项 · 点击展开`
                                    : "正在生成..."}
                        </span>
                    </span>
                </span>
                <span
                    className="text-text-muted text-xs"
                    aria-hidden="true"
                >
                    +
                </span>
            </button>

            {open ? (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label="资料清单"
                    className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8 animate-[fadeIn_180ms_ease-out]"
                    onClick={() => setOpen(false)}
                >
                    <div
                        aria-hidden="true"
                        className="absolute inset-0"
                        style={{
                            background: "rgba(31, 19, 7, 0.32)",
                            backdropFilter: "blur(6px)",
                            WebkitBackdropFilter: "blur(6px)",
                        }}
                    />

                    <div
                        className="relative w-full max-w-6xl animate-[popIn_240ms_cubic-bezier(0.22,1,0.36,1)]"
                        style={{
                            background: "var(--gradient-raised)",
                            borderRadius: 28,
                            boxShadow:
                                "var(--shadow-clay-card), 0 24px 48px -16px rgba(120, 53, 15, 0.35)",
                            maxHeight: "85vh",
                            display: "flex",
                            flexDirection: "column",
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <header className="flex items-center justify-between gap-4 px-7 pt-6 pb-3">
                            <div className="flex items-center gap-3">
                                <FolderIcon />
                                <div className="flex flex-col">
                                    <h2 className="text-text text-lg font-semibold">
                                        资料清单
                                    </h2>
                                    <p className="text-text-muted text-xs">
                                        {error
                                            ? "AI 暂时不可用，可联系顾问"
                                            : checklist
                                                ? `${itemCount} 项 · 按优先级分列`
                                                : "正在生成..."}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                aria-label="关闭"
                                onClick={() => setOpen(false)}
                                className="flex h-9 w-9 items-center justify-center transition-transform hover:scale-105 active:scale-95"
                                style={{
                                    borderRadius: 999,
                                    background: "var(--color-surface-alt)",
                                    boxShadow: "var(--shadow-clay-card)",
                                    color: "var(--color-text, #1f2937)",
                                }}
                            >
                                <svg
                                    width="14"
                                    height="14"
                                    viewBox="0 0 14 14"
                                    fill="none"
                                    aria-hidden="true"
                                >
                                    <path
                                        d="M3 3 L11 11 M11 3 L3 11"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                    />
                                </svg>
                            </button>
                        </header>

                        <div className="overflow-y-auto px-7 pb-7">
                            {error ? (
                                <div
                                    className="px-4 py-3 text-xs"
                                    style={{
                                        background: "var(--color-surface-alt)",
                                        borderRadius: "var(--radius-card)",
                                        color: "#9f1239",
                                    }}
                                >
                                    {error}
                                </div>
                            ) : null}

                            {checklist ? (
                                <>
                                    {checklist.summary ? (
                                        <p className="text-text-muted mb-5 text-sm">
                                            {checklist.summary}
                                        </p>
                                    ) : null}
                                    <div
                                        className="grid gap-6"
                                        style={{
                                            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                                        }}
                                    >
                                        {columns.map((colSections, ci) => (
                                            <div key={ci} className="space-y-5">
                                                {colSections.map(({ cat, items }) => {
                                                    const m = meta[cat];
                                                    return (
                                                        <section key={cat} className="space-y-2">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <div className="flex items-center gap-2">
                                                                    <span
                                                                        aria-hidden="true"
                                                                        style={{
                                                                            width: 8,
                                                                            height: 8,
                                                                            borderRadius: 999,
                                                                            background: m?.accent ?? "#a8a29e",
                                                                        }}
                                                                    />
                                                                    <h3 className="text-text text-sm font-semibold">
                                                                        {m?.label ?? cat}
                                                                    </h3>
                                                                    <span className="text-text-muted text-[10px] tabular-nums">
                                                                        {items.length}
                                                                    </span>
                                                                </div>
                                                                {m ? (
                                                                    <span
                                                                        className="px-2 py-0.5 text-[10px] font-semibold"
                                                                        style={{
                                                                            background: m.chip,
                                                                            color: m.chipText,
                                                                            borderRadius: 999,
                                                                        }}
                                                                    >
                                                                        {PRIORITY_LABEL[m.priority]}
                                                                    </span>
                                                                ) : null}
                                                            </div>
                                                            <ul className="space-y-2">
                                                                {items.map((it, i) => (
                                                                    <li
                                                                        key={`${cat}-${i}`}
                                                                        className="space-y-1 px-3 py-2"
                                                                        style={{
                                                                            background: m?.bg ?? "var(--color-surface-alt)",
                                                                            borderLeft: `3px solid ${m?.accent ?? "#a8a29e"}`,
                                                                            borderRadius: "var(--radius-button)",
                                                                        }}
                                                                    >
                                                                        <div className="flex flex-wrap items-center gap-2">
                                                                            <span className="text-text text-sm font-semibold">
                                                                                {it.title}
                                                                            </span>
                                                                            {it.confidence === "tentative" ? (
                                                                                <span
                                                                                    className="px-2 py-0.5 text-[10px] font-semibold"
                                                                                    style={{
                                                                                        background: "#fef3c7",
                                                                                        color: "#92400e",
                                                                                        borderRadius: 999,
                                                                                    }}
                                                                                >
                                                                                    请按官方页核对
                                                                                </span>
                                                                            ) : null}
                                                                        </div>
                                                                        <p className="text-text-muted text-xs">
                                                                            {it.description}
                                                                        </p>
                                                                        {it.applies_to.length > 0 ? (
                                                                            <ul className="flex flex-wrap gap-1">
                                                                                {it.applies_to.map((pid) => (
                                                                                    <li
                                                                                        key={pid}
                                                                                        className="text-text-muted text-[10px] px-1.5 py-0.5"
                                                                                        style={{
                                                                                            background: "#fff",
                                                                                            borderRadius: 999,
                                                                                        }}
                                                                                    >
                                                                                        {programNames[pid] ?? "未命名项目"}
                                                                                    </li>
                                                                                ))}
                                                                            </ul>
                                                                        ) : null}
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                            {m && m.links.length > 0 ? (
                                                                <ul className="flex flex-wrap gap-1.5 pt-1">
                                                                    {m.links.map((lk) => (
                                                                        <li key={lk.url}>
                                                                            <a
                                                                                href={lk.url}
                                                                                target="_blank"
                                                                                rel="noopener noreferrer"
                                                                                className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium transition-colors hover:underline"
                                                                                style={{
                                                                                    background: "#fff",
                                                                                    color: m.accent,
                                                                                    borderRadius: 999,
                                                                                    boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
                                                                                }}
                                                                            >
                                                                                <ExternalIcon />
                                                                                {lk.label}
                                                                            </a>
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            ) : null}
                                                        </section>
                                                    );
                                                })}
                                            </div>
                                        ))}
                                    </div>
                                </>
                            ) : null}
                        </div>
                    </div>

                    <style jsx>{`
                        @keyframes fadeIn {
                            from {
                                opacity: 0;
                            }
                            to {
                                opacity: 1;
                            }
                        }
                        @keyframes popIn {
                            from {
                                opacity: 0;
                                transform: translateY(12px) scale(0.97);
                            }
                            to {
                                opacity: 1;
                                transform: translateY(0) scale(1);
                            }
                        }
                    `}</style>
                </div>
            ) : null}
        </div>
    );
}

function ExternalIcon() {
    return (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
            <path d="M3 1 H1 V9 H9 V7 M5 1 H9 V5 M9 1 L4.5 5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}
function FolderIcon() {
    return (
        <span
            className="inline-flex h-10 w-12 shrink-0 items-center justify-center"
            style={{
                background: "var(--gradient-primary)",
                borderRadius: "var(--radius-button)",
                boxShadow: "var(--shadow-clay-raised)",
            }}
            aria-hidden="true"
        >
            <svg
                width="22"
                height="18"
                viewBox="0 0 22 18"
                fill="none"
                stroke="#fff"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path d="M2 4.5a2 2 0 0 1 2-2h4.5l2 2H18a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4.5Z" />
                <path d="M2 7h18" />
            </svg>
        </span>
    );
}
