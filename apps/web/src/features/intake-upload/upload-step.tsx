"use client";

/**
 * UploadStep
 *
 * Standalone "drop a resume" step between the rocket launcher and the
 * assessment. Uses the LLM (via summarizeUploadAction) to produce a short
 * free-form summary of each uploaded document so the user can verify the
 * contents before moving on. Supports multiple uploads in one session.
 */

import { useEffect, useState, useTransition } from "react";
import type { UploadDocumentSummary } from "@isp0526/core";
import { useRouter } from "../../i18n/navigation";
import { trackEvent } from "../../lib/analytics/track";
import { UploadPortal } from "./upload-portal";

const UPLOAD_SUMMARIES_KEY = "isp_intake_upload_summaries_v1";

const DOC_KIND_LABEL: Record<UploadDocumentSummary["doc_kind"], string> = {
    resume: "简历",
    transcript: "成绩单",
    recommendation_letter: "推荐信",
    personal_statement: "个人陈述",
    offer_letter: "Offer / 录取信",
    program_brochure: "项目宣传册",
    scholarship_letter: "奖学金材料",
    language_test_report: "语言成绩单",
    other: "其他材料",
};

interface UploadedSummary {
    readonly fileName: string;
    readonly summary: UploadDocumentSummary;
    readonly llmUsed: boolean;
}

export function UploadStep() {
    const router = useRouter();
    const [uploads, setUploads] = useState<ReadonlyArray<UploadedSummary>>([]);
    const [portalKey, setPortalKey] = useState(0);
    const [, startTransition] = useTransition();

    // Persist summaries so the downstream voyage step can use them as
    // grounding context for confirmation questions.
    useEffect(() => {
        if (typeof window === "undefined") return;
        try {
            window.sessionStorage.setItem(
                UPLOAD_SUMMARIES_KEY,
                JSON.stringify(uploads),
            );
        } catch {
            // ignore quota / private-mode errors
        }
    }, [uploads]);

    const goToAssessment = () => {
        trackEvent("intake_step_start", { channel: "assessment", step: 0 });
        startTransition(() => {
            router.push("/intake/assessment");
        });
    };

    const hasUploads = uploads.length > 0;
    const handleUploadAnother = () => setPortalKey((k) => k + 1);

    return (
        <main className="bg-bg flex min-h-screen w-full items-center justify-center px-6 py-12 sm:px-12">
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
                <header className="space-y-2 text-center">
                    <span className="text-text-muted text-sm uppercase tracking-widest">
                        Step 2 · 喂点资料
                    </span>
                    <h1 className="text-text text-3xl font-bold leading-tight sm:text-4xl">
                        有简历或成绩单吗？传一份
                    </h1>
                    <p className="text-text-muted mx-auto max-w-xl">
                        AI 会读完这份文件，给你一份要点总结。可以多传几份（简历 + 成绩单 + Offer 等），都看过没问题再进入下一步。
                    </p>
                </header>

                <UploadPortal
                    key={portalKey}
                    onResult={(r) => {
                        if (!r.ok || !r.summary) return;
                        setUploads((prev) => [
                            ...prev,
                            {
                                fileName: r.fileName,
                                summary: r.summary as UploadDocumentSummary,
                                llmUsed: r.llmUsed,
                            },
                        ]);
                        trackEvent("intake_step_start", {
                            channel: "upload",
                            step: 1,
                        });
                    }}
                />

                {hasUploads ? (
                    <section
                        className="rounded-card-md border p-5"
                        style={{
                            background: "var(--color-surface)",
                            borderColor:
                                "color-mix(in srgb, var(--color-primary-from) 30%, transparent)",
                            boxShadow: "var(--shadow-clay-card)",
                        }}
                    >
                        <div className="flex items-center justify-between gap-3">
                            <h2 className="text-text text-lg font-semibold">
                                AI 总结的关键信息
                            </h2>
                            <span className="text-text-muted text-xs">
                                已上传 {uploads.length} 份
                            </span>
                        </div>

                        <div className="mt-4 space-y-5">
                            {uploads.map((u, i) => (
                                <article
                                    key={`${u.fileName}-${i}`}
                                    className="rounded-card-md p-4"
                                    style={{
                                        background:
                                            "var(--color-surface-alt)",
                                    }}
                                >
                                    <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                                        <span
                                            className="rounded-button px-2 py-0.5 text-xs font-medium"
                                            style={{
                                                background:
                                                    "color-mix(in srgb, var(--color-primary-from) 18%, transparent)",
                                                color: "var(--color-primary-from)",
                                            }}
                                        >
                                            {DOC_KIND_LABEL[u.summary.doc_kind]}
                                        </span>
                                        <h3 className="text-text break-words text-base font-semibold">
                                            {u.summary.title}
                                        </h3>
                                        <span className="text-text-muted ml-auto truncate text-xs">
                                            {u.fileName}
                                        </span>
                                    </header>

                                    {u.summary.about_applicant &&
                                        u.summary.applicant_summary ? (
                                        <p className="text-text mt-3 text-sm leading-relaxed">
                                            {u.summary.applicant_summary}
                                        </p>
                                    ) : null}

                                    <ul className="text-text mt-3 space-y-1.5 text-sm">
                                        {u.summary.key_points.map((pt, j) => (
                                            <li key={j} className="flex gap-2">
                                                <span
                                                    className="mt-2 inline-block h-1.5 w-1.5 flex-none rounded-full"
                                                    style={{
                                                        background:
                                                            "var(--color-primary-from)",
                                                    }}
                                                    aria-hidden
                                                />
                                                <span className="break-words">
                                                    {pt}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>

                                    {!u.summary.about_applicant ? (
                                        <p className="text-text-muted mt-3 text-xs">
                                            这份文件看起来不是关于你本人的（比如院校宣传册或项目介绍），AI 不会把它当作你的个人背景来填表。
                                        </p>
                                    ) : null}
                                </article>
                            ))}
                        </div>

                        <div className="mt-6 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
                            <button
                                type="button"
                                onClick={handleUploadAnother}
                                className="text-text rounded-button border px-4 py-2 text-sm font-medium transition-colors"
                                style={{
                                    background: "var(--color-surface-alt)",
                                    borderColor:
                                        "color-mix(in srgb, var(--color-text-muted) 30%, transparent)",
                                }}
                            >
                                再传一份
                            </button>
                            <button
                                type="button"
                                onClick={goToAssessment}
                                className="rounded-button px-4 py-2 text-sm font-semibold transition-transform hover:-translate-y-px"
                                style={{
                                    background: "var(--gradient-primary)",
                                    color: "var(--color-text-on-primary)",
                                    boxShadow: "var(--shadow-clay-primary)",
                                }}
                            >
                                信息无误 → 进入下一步
                            </button>
                        </div>
                    </section>
                ) : null}

                <div className="flex justify-center pt-2">
                    <button
                        type="button"
                        onClick={goToAssessment}
                        className="text-text-muted hover:text-text text-xs underline decoration-dotted underline-offset-4 transition-colors"
                    >
                        没有文件，直接做测评 →
                    </button>
                </div>
            </div>
        </main>
    );
}
