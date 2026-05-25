import Link from "next/link";
import { notFound } from "next/navigation";
import type {
    RecommendationNarrative,
    Score,
} from "@isp0526/core";
import { loadReport } from "../../../lib/report-store";

interface ReportPageProps {
    readonly params: Promise<{ code: string }>;
}

export default async function ReportPage({ params }: ReportPageProps) {
    const { code } = await params;
    const snapshot = await loadReport(code);
    if (!snapshot) notFound();

    const sections = [
        { key: "match", title: "Match · 主推", scores: snapshot.set.match },
        { key: "stretch", title: "Stretch · 冲一冲", scores: snapshot.set.stretch },
        { key: "safety", title: "Safety · 保底", scores: snapshot.set.safety },
    ] as const;

    const llmCount = [...snapshot.narrative_sources.values()].filter(
        (s) => s === "llm",
    ).length;
    const totalCount = snapshot.narrative_sources.size;

    return (
        <main className="bg-bg min-h-screen w-full px-6 py-16 sm:px-12">
            <div className="mx-auto max-w-3xl space-y-10">
                <header className="space-y-2">
                    <span className="text-text-muted text-sm uppercase tracking-widest">
                        Report · {snapshot.code}
                    </span>
                    <h1 className="text-text text-3xl font-bold leading-tight sm:text-4xl">
                        你的澳洲院校推荐
                    </h1>
                    <p className="text-text-muted">
                        所有结论来自规则引擎对你的画像与项目数据的逐项比对，每条理由可追溯到原始来源。
                    </p>
                    {totalCount > 0 ? (
                        <p className="text-text-muted text-xs">
                            文案来源：Gemini {llmCount} 项 · 模板 {totalCount - llmCount} 项
                        </p>
                    ) : null}
                    <div className="flex flex-wrap gap-2 pt-2">
                        <a
                            href={`/r/${snapshot.code}/pdf`}
                            target="_blank"
                            rel="noopener"
                            className="text-text px-4 py-2 text-sm font-semibold transition-transform active:scale-95"
                            style={{
                                background: "var(--gradient-raised)",
                                borderRadius: "var(--radius-button)",
                                boxShadow: "var(--shadow-clay-raised)",
                            }}
                        >
                            下载 PDF
                        </a>
                        <a
                            href={`/r/${snapshot.code}/poster.png`}
                            target="_blank"
                            rel="noopener"
                            className="text-text px-4 py-2 text-sm font-semibold transition-transform active:scale-95"
                            style={{
                                background: "var(--gradient-raised)",
                                borderRadius: "var(--radius-button)",
                                boxShadow: "var(--shadow-clay-raised)",
                            }}
                        >
                            微信分享图
                        </a>
                    </div>
                </header>

                {sections.map((section) => (
                    <section key={section.key} className="space-y-4">
                        <h2 className="text-text text-xl font-semibold">
                            {section.title}
                            <span className="text-text-muted ml-2 text-sm font-normal">
                                {section.scores.length} 项
                            </span>
                        </h2>
                        {section.scores.length === 0 ? (
                            <p className="text-text-muted text-sm">
                                这一档暂时没有匹配。
                            </p>
                        ) : (
                            <div className="space-y-4">
                                {section.scores.map((score) => (
                                    <ScoreCard
                                        key={score.program_id}
                                        score={score}
                                        narrative={snapshot.narratives.get(
                                            score.program_id,
                                        )}
                                        source={snapshot.narrative_sources.get(
                                            score.program_id,
                                        )}
                                    />
                                ))}
                            </div>
                        )}
                    </section>
                ))}

                <ContactCard code={snapshot.code} />
            </div>
        </main>
    );
}

function ScoreCard({
    score,
    narrative,
    source,
}: {
    score: Score;
    narrative: RecommendationNarrative | undefined;
    source: "llm" | "template" | undefined;
}) {
    return (
        <article
            className="bg-surface space-y-3 p-6"
            style={{
                borderRadius: "var(--radius-card-md)",
                boxShadow: "var(--shadow-clay-card)",
            }}
        >
            <div className="flex items-start justify-between gap-4">
                <h3 className="text-text text-lg font-semibold">
                    {narrative?.headline ??
                        `${score.university_id} · ${score.program_id}`}
                </h3>
                <div className="flex shrink-0 items-center gap-2">
                    {source ? (
                        <span
                            className="text-text-muted rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider"
                            style={{ background: "var(--color-surface-alt)" }}
                            title={
                                source === "llm"
                                    ? "本条推荐文案由 Gemini 2.0 Flash 生成，并经 Zod 校验 + 来源过滤"
                                    : "本条推荐文案由模板渲染（LLM 未启用或已回退）"
                            }
                        >
                            {source === "llm" ? "AI" : "模板"}
                        </span>
                    ) : null}
                    <span
                        className="text-text rounded-full px-3 py-1 text-sm font-semibold"
                        style={{
                            background: "var(--color-surface-alt)",
                        }}
                    >
                        {Math.round(score.final_score)}
                    </span>
                </div>
            </div>
            {narrative ? (
                <p className="text-text-muted text-sm leading-relaxed">
                    {narrative.summary}
                </p>
            ) : null}
            <ul className="space-y-1.5 text-sm">
                {(narrative?.pros ?? []).map((p, i) => (
                    <li key={i} className="text-text flex gap-2">
                        <span aria-hidden className="text-accent">·</span>
                        <span>
                            {p.text}
                            <span className="text-text-muted ml-1 text-xs">
                                ({p.source_id})
                            </span>
                        </span>
                    </li>
                ))}
            </ul>
            <details className="text-text-muted text-xs">
                <summary className="cursor-pointer">维度分解</summary>
                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
                    {Object.entries(score.breakdown).map(([k, v]) => (
                        <div key={k} className="contents">
                            <dt>{k}</dt>
                            <dd className="text-text">{(v * 100).toFixed(0)}</dd>
                        </div>
                    ))}
                </dl>
            </details>
        </article>
    );
}

function ContactCard({ code }: { code: string }) {
    return (
        <section
            className="space-y-3 p-6"
            style={{
                background: "var(--color-surface-alt)",
                borderRadius: "var(--radius-card-md)",
                boxShadow: "var(--shadow-clay-raised)",
            }}
        >
            <h2 className="text-text text-lg font-semibold">想找人聊聊？</h2>
            <p className="text-text-muted text-sm">
                报告里任何想再深入聊的地方，可以加我们。把下面的 ID 发给我们，我们就能调出你的完整方案。
            </p>
            <div
                className="text-text inline-block px-4 py-2 font-mono text-base font-semibold"
                style={{
                    background: "var(--color-surface)",
                    borderRadius: "var(--radius-button)",
                    boxShadow: "var(--shadow-clay-inset)",
                }}
            >
                {code}
            </div>
            <div className="flex flex-col gap-2 pt-2 sm:flex-row">
                <Link
                    href="#"
                    className="text-text-on-primary px-5 py-2.5 text-sm font-semibold"
                    style={{
                        background: "var(--gradient-primary)",
                        borderRadius: "var(--radius-button)",
                        boxShadow: "var(--shadow-clay-primary)",
                    }}
                >
                    WhatsApp
                </Link>
                <Link
                    href="#"
                    className="text-text px-5 py-2.5 text-sm font-semibold"
                    style={{
                        background: "var(--gradient-raised)",
                        borderRadius: "var(--radius-button)",
                        boxShadow: "var(--shadow-clay-raised)",
                    }}
                >
                    WeChat
                </Link>
            </div>
        </section>
    );
}
