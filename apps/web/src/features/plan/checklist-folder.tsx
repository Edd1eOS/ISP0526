"use client";

import { useState } from "react";
import type { PlanChecklist } from "@isp0526/core";

interface ChecklistFolderProps {
    readonly checklist: PlanChecklist | null;
    readonly error?: string;
    readonly programNames: Readonly<Record<string, string>>;
}

const CATEGORY_LABEL: Record<string, string> = {
    academic: "学术材料",
    language: "语言成绩",
    personal: "个人材料",
    financial: "资金证明",
    visa: "签证准备",
    other: "其他",
};

export function ChecklistFolder({
    checklist,
    error,
    programNames,
}: ChecklistFolderProps) {
    const [open, setOpen] = useState(false);

    const itemCount = checklist?.items.length ?? 0;
    const grouped = new Map<string, PlanChecklist["items"]>();
    if (checklist) {
        for (const it of checklist.items) {
            const list = grouped.get(it.category) ?? [];
            list.push(it);
            grouped.set(it.category, list);
        }
    }

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
                                    ? `${itemCount} 项 · 点击${open ? "收起" : "展开"}`
                                    : "正在生成..."}
                        </span>
                    </span>
                </span>
                <span
                    className="text-text-muted text-xs"
                    aria-hidden="true"
                >
                    {open ? "−" : "+"}
                </span>
            </button>

            {open && error ? (
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

            {open && checklist ? (
                <div
                    className="space-y-4 px-4 py-4"
                    style={{
                        background: "var(--gradient-raised)",
                        borderRadius: "var(--radius-card)",
                        boxShadow: "var(--shadow-clay-card)",
                    }}
                >
                    <p className="text-text-muted text-xs">
                        {checklist.summary}
                    </p>
                    {Array.from(grouped.entries()).map(([cat, items]) => (
                        <section key={cat} className="space-y-2">
                            <h3 className="text-text text-sm font-semibold">
                                {CATEGORY_LABEL[cat] ?? cat}
                            </h3>
                            <ul className="space-y-2">
                                {items.map((it, i) => (
                                    <li
                                        key={`${cat}-${i}`}
                                        className="space-y-1 px-3 py-2"
                                        style={{
                                            background:
                                                "var(--color-surface-alt)",
                                            borderRadius:
                                                "var(--radius-button)",
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
                                                        borderRadius: "999px",
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
                                                            borderRadius:
                                                                "999px",
                                                        }}
                                                    >
                                                        {programNames[pid] ??
                                                            pid}
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : null}
                                    </li>
                                ))}
                            </ul>
                        </section>
                    ))}
                </div>
            ) : null}
        </div>
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
