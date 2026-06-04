import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type {
    Candidate,
    Country,
    RecommendationNarrative,
    Score,
    ScoreBreakdown,
} from "@isp0526/core";
import { getVisaRoutes } from "@isp0526/core";
import { loadReport } from "../../../../lib/report-store";
import {
    BottlesGrid,
    type BottleCard,
    type BottleSection,
} from "../../../../features/report/bottles";
import { JourneyMap } from "../../../../features/report/journey-map";
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
    MY: "马来西亚",
    TH: "泰国",
    DE: "德国",
    NL: "荷兰",
    IE: "爱尔兰",
    RU: "俄罗斯",
    TW: "中国台湾",
    MO: "中国澳门",
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

// Highest-dimension flag shown in the collapsed capsule row. The colour is
// inline (not a Tailwind class) so the bundler does not purge dynamic values.
const DIMENSION_FLAG: Record<
    keyof ScoreBreakdown,
    { label: string; bg: string; fg: string }
> = {
    academic_fit: { label: "专业强劲", bg: "#e0e7ff", fg: "#3730a3" },
    personality: { label: "性格契合", bg: "#ffe4e6", fg: "#9f1239" },
    lifestyle: { label: "生活舒适", bg: "#fef3c7", fg: "#92400e" },
    career: { label: "就业前景", bg: "#d1fae5", fg: "#065f46" },
    budget: { label: "性价比高", bg: "#cffafe", fg: "#155e75" },
    tag_boost: { label: "目标契合", bg: "#ede9fe", fg: "#5b21b6" },
    reputation: { label: "口碑硬核", bg: "#e2e8f0", fg: "#1e293b" },
    visa_feasibility: { label: "签证友好", bg: "#ccfbf1", fg: "#115e59" },
};

// Tier-relative flag: pick the dimension where this candidate stands out the
// most compared to its tier peers. This gives variety — otherwise the same
// systemically-dominant dimension (e.g. budget for the safety tier) would
// flag every card identically.
function topDimensionRelative(
    breakdown: ScoreBreakdown,
    tierAverages: Record<keyof ScoreBreakdown, number>,
): keyof ScoreBreakdown {
    const entries = Object.entries(breakdown) as Array<
        [keyof ScoreBreakdown, number]
    >;
    let bestKey: keyof ScoreBreakdown = "academic_fit";
    let bestDelta = -Infinity;
    for (const [k, v] of entries) {
        const delta = v - tierAverages[k];
        if (delta > bestDelta) {
            bestDelta = delta;
            bestKey = k;
        }
    }
    return bestKey;
}

function computeTierAverages(
    scores: ReadonlyArray<Score>,
): Record<keyof ScoreBreakdown, number> {
    const keys = Object.keys(DIMENSION_LABEL) as (keyof ScoreBreakdown)[];
    const sums: Record<string, number> = {};
    for (const k of keys) sums[k] = 0;
    if (scores.length === 0) {
        return sums as Record<keyof ScoreBreakdown, number>;
    }
    for (const s of scores) {
        for (const k of keys) sums[k] += s.breakdown[k];
    }
    const out = {} as Record<keyof ScoreBreakdown, number>;
    for (const k of keys) out[k] = sums[k]! / scores.length;
    return out;
}

const BOTTLE_ACCENT: Record<"match" | "stretch" | "safety", string> = {
    match: "linear-gradient(135deg, #fde68a 0%, #fbbf24 100%)",
    stretch: "linear-gradient(135deg, #fecaca 0%, #f87171 100%)",
    safety: "linear-gradient(135deg, #bbf7d0 0%, #34d399 100%)",
};

function buildBottleCards(
    scores: ReadonlyArray<Score>,
    snapshot: {
        candidates: ReadonlyMap<string, Candidate>;
        narratives: ReadonlyMap<string, RecommendationNarrative>;
        narrative_sources: ReadonlyMap<string, "llm" | "template">;
    },
): ReadonlyArray<BottleCard> {
    const tierAvg = computeTierAverages(scores);
    return scores.map((s) => {
        const cand = snapshot.candidates.get(s.program_id);
        const narr = snapshot.narratives.get(s.program_id);
        const src = snapshot.narrative_sources.get(s.program_id);
        const flagKey = topDimensionRelative(s.breakdown, tierAvg);
        const flag = DIMENSION_FLAG[flagKey];
        return {
            programId: s.program_id,
            headline: narr?.headline ?? `${s.university_id} · ${s.program_id}`,
            scoreInt: Math.round(s.final_score),
            flagKey,
            flagLabel: flag.label,
            flagBg: flag.bg,
            flagFg: flag.fg,
            country: cand
                ? COUNTRY_LABEL[cand.university.country]
                : undefined,
            city: cand?.university.city,
            summary: narr?.summary,
            pros: (narr?.pros ?? []).map((p) => ({
                text: p.text,
                sourceId: p.source_id,
            })),
            breakdown: s.breakdown,
            source: src,
        };
    });
}

export default async function ReportPage({ params }: ReportPageProps) {
    const { code, locale } = await params;
    setRequestLocale(locale);
    const snapshot = await loadReport(code);
    if (!snapshot) notFound();

    const expiredAt = new Date(
        new Date(snapshot.created_at).getTime() +
        SHARE_LINK_EXPIRY_DAYS * 86_400_000,
    );
    // reason: Server Component render is a one-shot; Date.now() is acceptable here.
    // eslint-disable-next-line react-hooks/purity
    const nowMs = Date.now();
    if (expiredAt.getTime() < nowMs) {
        return <ExpiredReport locale={locale} code={snapshot.code} />;
    }

    const t = await getTranslations({ locale, namespace: "report" });
    const routes = getVisaRoutes();

    const sections = [
        { key: "match", title: "主推", scores: snapshot.set.match },
        { key: "stretch", title: "冲一冲", scores: snapshot.set.stretch },
        { key: "safety", title: "保底", scores: snapshot.set.safety },
    ] as const;

    const bottleSections: ReadonlyArray<BottleSection> = sections.map((s) => ({
        key: s.key,
        title: s.title,
        accent: BOTTLE_ACCENT[s.key],
        cards: buildBottleCards(s.scores, snapshot),
    }));

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
        <main className="bg-bg min-h-screen w-full px-6 py-10 sm:px-12">
            <div className="mx-auto max-w-6xl space-y-8">
                <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div className="space-y-1">
                        <span className="text-text-muted text-xs tracking-widest">
                            报告编号 · {snapshot.code}
                        </span>
                        <h1 className="text-text text-2xl font-bold leading-tight sm:text-3xl">
                            你的留学院校推荐
                        </h1>
                        {totalCount > 0 ? (
                            <p className="text-text-muted text-xs">
                                内容来源：自动生成 {llmCount} 项 · 模板 {totalCount - llmCount} 项
                            </p>
                        ) : null}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                        <a
                            href={`/r/${snapshot.code}/pdf`}
                            target="_blank"
                            rel="noopener"
                            className="text-text px-3 py-1.5 text-xs font-semibold transition-transform active:scale-95"
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
                            className="text-text px-3 py-1.5 text-xs font-semibold transition-transform active:scale-95"
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

                <BottlesGrid sections={bottleSections} />

                <JourneyMap
                    countries={[...presentCountries]}
                    routes={routes}
                    countryLabels={COUNTRY_LABEL}
                />
                <div
                    className="flex flex-col items-start gap-3 px-5 py-5 sm:flex-row sm:items-center sm:justify-between"
                    style={{
                        background: "var(--gradient-raised)",
                        borderRadius: "var(--radius-card)",
                        boxShadow: "var(--shadow-clay-card)",
                    }}
                >
                    <div className="space-y-1">
                        <h2 className="text-text text-base font-semibold">
                            选择 6 所院校生成投递方案
                        </h2>
                        <p className="text-text-muted text-xs">
                            按 2 冲 / 3 稳 / 1 保整理时间轴和资料清单。
                        </p>
                    </div>
                    <Link
                        href={`/r/${snapshot.code}/select`}
                        className="px-4 py-2 text-sm font-semibold text-white transition-transform active:scale-95"
                        style={{
                            background: "var(--gradient-primary)",
                            borderRadius: "var(--radius-button)",
                            boxShadow: "var(--shadow-clay-raised)",
                        }}
                    >
                        开始选择
                    </Link>
                </div>
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

// ScoreCard + BreakdownRadar moved to features/report/bottles.tsx.
// VisaOverview + ApplicationTimeline replaced by JourneyMap (features/report/journey-map.tsx).


