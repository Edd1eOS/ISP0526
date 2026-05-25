import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type {
    Candidate,
    Country,
    RecommendationNarrative,
    Score,
    ScoreBreakdown,
    VisaRoute,
    VisaRouteMap,
} from "@isp0526/core";
import { getVisaRoutes } from "@isp0526/core";
import { loadReport } from "../../../../lib/report-store";
import { ReportChat } from "../../../../features/report/report-chat";
import { ContactCard } from "../../../../features/report/contact-card";
import { Link } from "../../../../i18n/navigation";

interface ReportPageProps {
    readonly params: Promise<{ code: string; locale: string }>;
}

const SHARE_LINK_EXPIRY_DAYS = 30;

const COUNTRY_LABEL: Record<Country, string> = {
    AU: "澳大利亚",
    UK: "英国",
    CA: "加拿大",
    US: "美国",
    NZ: "新西兰",
    HK: "香港",
    SG: "新加坡",
};

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

export default async function ReportPage({ params }: ReportPageProps) {
    const { code, locale } = await params;
    setRequestLocale(locale);
    const snapshot = await loadReport(code);
    if (!snapshot) notFound();

    const expiredAt = new Date(
        new Date(snapshot.created_at).getTime() +
            SHARE_LINK_EXPIRY_DAYS * 86_400_000,
    );
    if (expiredAt.getTime() < Date.now()) {
        return <ExpiredReport locale={locale} code={snapshot.code} />;
    }

    const t = await getTranslations({ locale, namespace: "report" });
    const routes = getVisaRoutes();

    const sections = [
        { key: "match", title: "Match · 主推", scores: snapshot.set.match },
        { key: "stretch", title: "Stretch · 冲一冲", scores: snapshot.set.stretch },
        { key: "safety", title: "Safety · 保底", scores: snapshot.set.safety },
    ] as const;

    const allScores: Score[] = [
        ...snapshot.set.stretch,
        ...snapshot.set.match,
        ...snapshot.set.safety,
    ];
    const presentCountries = new Set<Country>();
    for (const s of allScores) {
        const c = snapshot.candidates.get(s.program_id);
        if (c) presentCountries.add(c.university.country);
    }

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
                        你的留学院校推荐
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
                                        candidate={snapshot.candidates.get(
                                            score.program_id,
                                        )}
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

                <VisaOverview countries={presentCountries} routes={routes} />
                <ApplicationTimeline
                    countries={presentCountries}
                    routes={routes}
                />
                <ReportChat code={snapshot.code} />
                <ContactCard
                    code={snapshot.code}
                    labels={{
                        title: t("contactCard.title"),
                        body: t("contactCard.body"),
                        cta: t("contactCard.cta"),
                        idLabel: t("contactCard.idLabel"),
                    }}
                />
                <p className="text-text-muted text-xs">
                    {t("expiryNote", {
                        date: expiredAt.toLocaleDateString(
                            locale === "zh" ? "zh-CN" : "en-AU",
                        ),
                    })}
                </p>
            </div>
        </main>
    );
}

function ExpiredReport({ locale, code }: { locale: string; code: string }) {
    const isZh = locale === "zh";
    return (
        <main className="bg-bg min-h-screen w-full px-6 py-16 sm:px-12">
            <div className="mx-auto max-w-2xl space-y-4">
                <span className="text-text-muted text-sm uppercase tracking-widest">
                    Report · {code}
                </span>
                <h1 className="text-text text-2xl font-semibold">
                    {isZh
                        ? "分享链接已过期"
                        : "This share link has expired"}
                </h1>
                <p className="text-text-muted">
                    {isZh
                        ? `报告分享链接有效期 ${SHARE_LINK_EXPIRY_DAYS} 天，请重新生成一份报告，或联系我们用报告 ID 调取留底。`
                        : `Share links expire after ${SHARE_LINK_EXPIRY_DAYS} days. Please run the assessment again or contact us with your report ID to retrieve the archived copy.`}
                </p>
                <div className="flex flex-wrap gap-2 pt-2">
                    <Link
                        href="/intake"
                        className="text-text-on-primary px-5 py-2.5 text-sm font-semibold"
                        style={{
                            background: "var(--gradient-primary)",
                            borderRadius: "var(--radius-button)",
                            boxShadow: "var(--shadow-clay-primary)",
                        }}
                    >
                        {isZh ? "重新生成报告" : "Run a new assessment"}
                    </Link>
                    <Link
                        href={`/contact?code=${code}`}
                        className="text-text px-5 py-2.5 text-sm font-semibold"
                        style={{
                            background: "var(--gradient-raised)",
                            borderRadius: "var(--radius-button)",
                            boxShadow: "var(--shadow-clay-raised)",
                        }}
                    >
                        {isZh ? "联系我们" : "Contact us"}
                    </Link>
                </div>
            </div>
        </main>
    );
}

function ScoreCard({
    score,
    candidate,
    narrative,
    source,
}: {
    score: Score;
    candidate: Candidate | undefined;
    narrative: RecommendationNarrative | undefined;
    source: "llm" | "template" | undefined;
}) {
    const country = candidate?.university.country;
    const city = candidate?.university.city;
    return (
        <article
            className="bg-surface space-y-3 p-6"
            style={{
                borderRadius: "var(--radius-card-md)",
                boxShadow: "var(--shadow-clay-card)",
            }}
        >
            <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                    <h3 className="text-text text-lg font-semibold">
                        {narrative?.headline ??
                            `${score.university_id} · ${score.program_id}`}
                    </h3>
                    {country ? (
                        <p className="text-text-muted text-xs">
                            <span
                                className="mr-2 inline-block rounded-full px-2 py-0.5 font-medium"
                                style={{
                                    background: "var(--color-surface-alt)",
                                }}
                            >
                                {COUNTRY_LABEL[country]}
                            </span>
                            {city ?? ""}
                        </p>
                    ) : null}
                </div>
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
            <BreakdownRadar breakdown={score.breakdown} />
        </article>
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
        <details className="text-text-muted text-xs">
            <summary className="cursor-pointer">维度分解</summary>
            <div className="mt-3 flex flex-col items-center gap-3 sm:flex-row sm:items-start">
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
                    {entries.map((_, i) => {
                        const [x, y] = polar(i, radius);
                        return (
                            <line
                                key={i}
                                x1={cx}
                                y1={cy}
                                x2={x}
                                y2={y}
                                stroke="currentColor"
                                strokeOpacity={0.1}
                            />
                        );
                    })}
                    <polygon
                        points={valuePoints}
                        fill="var(--color-accent, #6366f1)"
                        fillOpacity={0.25}
                        stroke="var(--color-accent, #6366f1)"
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
                                fontSize={9}
                                fill="currentColor"
                                fillOpacity={0.7}
                            >
                                {e.label}
                            </text>
                        );
                    })}
                </svg>
                <dl className="grid w-full grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-2">
                    {entries.map((e) => (
                        <div key={e.key} className="contents">
                            <dt>{e.label}</dt>
                            <dd className="text-text">
                                {(e.value * 100).toFixed(0)}
                            </dd>
                        </div>
                    ))}
                </dl>
            </div>
        </details>
    );
}

function VisaOverview({
    countries,
    routes,
}: {
    countries: ReadonlySet<Country>;
    routes: VisaRouteMap;
}) {
    const items: Array<[Country, VisaRoute]> = [];
    for (const c of countries) {
        const route = routes[c];
        if (route) items.push([c, route]);
    }
    if (items.length === 0) return null;
    return (
        <section className="space-y-4">
            <h2 className="text-text text-xl font-semibold">签证一览</h2>
            <p className="text-text-muted text-sm">
                每个目的国的典型办理周期与毕业工签年限，数据来源为官方移民局。最终以受理时移民局公告为准。
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
                {items.map(([country, route]) => (
                    <article
                        key={country}
                        className="bg-surface space-y-2 p-5"
                        style={{
                            borderRadius: "var(--radius-card-md)",
                            boxShadow: "var(--shadow-clay-card)",
                        }}
                    >
                        <div className="flex items-baseline justify-between">
                            <h3 className="text-text text-base font-semibold">
                                {COUNTRY_LABEL[country]} · {route.visa_class}
                            </h3>
                            <span className="text-text-muted text-xs">
                                {route.total_weeks_typical} 周
                            </span>
                        </div>
                        <p className="text-text-muted text-xs">
                            毕业工签：{route.post_study_work_years} 年
                        </p>
                        <ol className="text-text space-y-1 text-xs">
                            {route.steps.map((step) => (
                                <li key={step.id} className="flex justify-between">
                                    <span>{step.name_en}</span>
                                    <span className="text-text-muted ml-2">
                                        ~{step.weeks}w
                                    </span>
                                </li>
                            ))}
                        </ol>
                        <p className="text-text-muted text-[10px]">
                            来源：{route.source.source_id}
                            {route.source.last_verified_date
                                ? ` · ${route.source.last_verified_date}`
                                : ""}
                        </p>
                    </article>
                ))}
            </div>
        </section>
    );
}

function ApplicationTimeline({
    countries,
    routes,
}: {
    countries: ReadonlySet<Country>;
    routes: VisaRouteMap;
}) {
    const items: Array<{ country: Country; route: VisaRoute }> = [];
    for (const c of countries) {
        const r = routes[c];
        if (r) items.push({ country: c, route: r });
    }
    if (items.length === 0) return null;
    const maxWeeks = Math.max(...items.map((i) => i.route.total_weeks_typical));
    return (
        <section className="space-y-4">
            <h2 className="text-text text-xl font-semibold">申请节奏</h2>
            <p className="text-text-muted text-sm">
                以拿到 offer 为时间零点向后推。条形长度反映典型办理周数，便于你判断递交时机。
            </p>
            <div
                className="bg-surface space-y-3 p-5"
                style={{
                    borderRadius: "var(--radius-card-md)",
                    boxShadow: "var(--shadow-clay-card)",
                }}
            >
                {items.map(({ country, route }) => {
                    const pct = (route.total_weeks_typical / maxWeeks) * 100;
                    return (
                        <div key={country} className="space-y-1">
                            <div className="text-text flex justify-between text-xs">
                                <span className="font-medium">
                                    {COUNTRY_LABEL[country]}
                                </span>
                                <span className="text-text-muted">
                                    {route.total_weeks_typical} 周 ·{" "}
                                    {route.steps.length} 步
                                </span>
                            </div>
                            <div
                                className="h-2 w-full overflow-hidden rounded-full"
                                style={{ background: "var(--color-surface-alt)" }}
                            >
                                <div
                                    className="h-full"
                                    style={{
                                        width: `${pct}%`,
                                        background: "var(--gradient-primary)",
                                    }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}


