import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import type {
    Country,
    PlanChecklist,
    ChecklistContextProgram,
    Candidate,
    Score,
} from "@isp0526/core";
import {
    COUNTRY_CALENDARS,
    generatePlanChecklist,
    resolveMilestoneForIntake,
} from "@isp0526/core";
import { loadReport } from "../../../../../lib/report-store";
import {
    buildGooglePlanChecklistGenerator,
} from "../../../../../lib/ai/google-plan-checklist";
import { isLLMConfigured } from "../../../../../lib/ai/google-narrative";
import { ContactCard } from "../../../../../features/report/contact-card";
import { Pyramid, type PyramidCard } from "../../../../../features/plan/pyramid";
import {
    TimelineSlider,
    type TimelineEvent,
} from "../../../../../features/plan/timeline-slider";
import { ChecklistFolder } from "../../../../../features/plan/checklist-folder";
import { Link } from "../../../../../i18n/navigation";

interface PlanPageProps {
    readonly params: Promise<{ code: string; locale: string }>;
    readonly searchParams: Promise<{ picks?: string; intake?: string }>;
}

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

interface ParsedPick {
    readonly tier: "stretch" | "match" | "safety";
    readonly programId: string;
}

function parseIntakeYear(raw: string | undefined): number {
    // Accept either `YYYY-MM` or `YYYY`. Default to the upcoming calendar
    // year so the timeline still renders if the user lands without a pick.
    const fallback = new Date().getUTCFullYear() + 1;
    if (!raw) return fallback;
    const yearStr = raw.split("-")[0];
    if (!yearStr) return fallback;
    const year = Number(yearStr);
    if (!Number.isFinite(year) || year < 2000 || year > 2100) return fallback;
    return year;
}

function parsePicks(raw: string | undefined): ParsedPick[] {
    if (!raw) return [];
    return raw
        .split(",")
        .map((token) => {
            const [prefix, ...rest] = token.split(":");
            const programId = rest.join(":");
            if (!programId) return null;
            if (prefix === "s") return { tier: "stretch", programId } as const;
            if (prefix === "m") return { tier: "match", programId } as const;
            if (prefix === "f") return { tier: "safety", programId } as const;
            return null;
        })
        .filter((p): p is ParsedPick => p !== null);
}

function findScore(
    snapshot: NonNullable<Awaited<ReturnType<typeof loadReport>>>,
    programId: string,
): Score | undefined {
    return (
        snapshot.set.stretch.find((s) => s.program_id === programId) ??
        snapshot.set.match.find((s) => s.program_id === programId) ??
        snapshot.set.safety.find((s) => s.program_id === programId)
    );
}

export default async function PlanPage({ params, searchParams }: PlanPageProps) {
    const { code, locale } = await params;
    const { picks: rawPicks, intake: rawIntake } = await searchParams;
    setRequestLocale(locale);
    const snapshot = await loadReport(code);
    if (!snapshot) notFound();

    const picks = parsePicks(rawPicks);
    const intakeYear = parseIntakeYear(rawIntake);
    if (picks.length === 0) {
        return <EmptyPicksState code={code} locale={locale} />;
    }

    const t = await getTranslations({ locale, namespace: "report" });

    // Resolve full candidate info for each pick.
    const resolved: Array<{
        readonly pick: ParsedPick;
        readonly candidate: Candidate;
        readonly score: number;
    }> = [];
    for (const p of picks) {
        const cand = snapshot.candidates.get(p.programId);
        const sc = findScore(snapshot, p.programId);
        if (!cand || !sc) continue;
        resolved.push({
            pick: p,
            candidate: cand,
            score: Math.round(sc.final_score),
        });
    }

    const pyramidCards: PyramidCard[] = resolved.map((r) => ({
        programId: r.pick.programId,
        tier: r.pick.tier,
        score: r.score,
        universityName:
            r.candidate.university.name_zh ?? r.candidate.university.name_en,
        programName:
            r.candidate.program.name_zh ?? r.candidate.program.name_en,
        country: r.candidate.university.country,
        city: r.candidate.university.city ?? null,
    }));

    const programNames: Record<string, string> = {};
    const countries = new Set<string>();
    for (const r of resolved) {
        programNames[r.pick.programId] = r.candidate.university.name_zh ??
            r.candidate.university.name_en;
        countries.add(r.candidate.university.country);
    }

    // Build a merged timeline from the country calendar template, grouped by
    // milestone key so identical events (e.g. UK 9 月开学) appear once with
    // their owning program_ids attached.
    const timeline = buildTimeline(resolved, intakeYear);

    // Generate the checklist via LLM if configured; otherwise show a graceful
    // fallback message. The server component awaits the LLM here.
    const checklistResult = await generateChecklistOrFallback(
        resolved,
        locale,
    );

    const expiredAt = new Date(
        new Date(snapshot.created_at).getTime() + 30 * 86_400_000,
    );

    return (
        <main className="bg-bg min-h-screen w-full px-6 py-10 sm:px-12">
            <div className="mx-auto max-w-5xl space-y-8">
                <header className="space-y-2">
                    <Link
                        href={`/r/${code}`}
                        className="text-text-muted text-xs hover:underline"
                    >
                        ← 回报告
                    </Link>
                    <h1 className="text-text text-2xl font-bold sm:text-3xl">
                        你的留学方案
                    </h1>
                    <p className="text-text-muted text-sm">
                        2 冲 / 3 稳 / 1 保 · 按优先级从上到下推进
                    </p>
                </header>

                <section className="space-y-3">
                    <h2 className="text-text text-lg font-semibold">
                        优先级金字塔
                    </h2>
                    <Pyramid cards={pyramidCards} />
                </section>

                <section
                    className="space-y-4 px-5 py-5"
                    style={{
                        background: "var(--gradient-raised)",
                        borderRadius: "var(--radius-card)",
                        boxShadow: "var(--shadow-clay-card)",
                    }}
                >
                    <header className="flex flex-wrap items-baseline justify-between gap-2">
                        <h2 className="text-text text-lg font-semibold">
                            时间轴
                        </h2>
                        <p className="text-text-muted text-xs">
                            滑动查看每个关键节点要做的事
                        </p>
                    </header>
                    <TimelineSlider
                        events={timeline}
                        programNames={programNames}
                    />
                </section>

                <section className="space-y-3">
                    <h2 className="text-text text-lg font-semibold">
                        资料清单
                    </h2>
                    <ChecklistFolder
                        checklist={checklistResult.checklist}
                        error={checklistResult.error}
                        programNames={programNames}
                        countries={Array.from(countries)}
                    />
                </section>

                <ContactCard
                    code={snapshot.code}
                    labels={{
                        title: t("contactCard.title"),
                        body: t("contactCard.body"),
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

function buildTimeline(
    resolved: ReadonlyArray<{
        readonly pick: ParsedPick;
        readonly candidate: Candidate;
    }>,
    intakeYear: number,
): TimelineEvent[] {
    // event key = `${country}:${milestoneKey}` so milestones shared by
    // multiple programs in the same country collapse into one entry.
    const merged = new Map<string, TimelineEvent>();
    for (const r of resolved) {
        const country = r.candidate.university.country;
        const cal = COUNTRY_CALENDARS[country];
        for (const m of cal.milestones) {
            const key = `${country}:${m.key}`;
            const date = resolveMilestoneForIntake(country, m, intakeYear);
            const iso = date.toISOString().slice(0, 10);
            const existing = merged.get(key);
            if (existing) {
                merged.set(key, {
                    ...existing,
                    programIds: [...existing.programIds, r.pick.programId],
                });
            } else {
                merged.set(key, {
                    key,
                    label: `${COUNTRY_LABEL[country]} · ${m.label_zh}`,
                    date: iso,
                    programIds: [r.pick.programId],
                    note: cal.note_zh,
                    kind: m.key,
                });
            }
        }
    }
    return Array.from(merged.values());
}

async function generateChecklistOrFallback(
    resolved: ReadonlyArray<{
        readonly pick: ParsedPick;
        readonly candidate: Candidate;
    }>,
    locale: string,
): Promise<{ checklist: PlanChecklist | null; error?: string }> {
    if (!isLLMConfigured() || resolved.length === 0) {
        return {
            checklist: null,
            error: "暂未配置 AI 生成，可联系顾问拿模板。",
        };
    }
    const programs: ChecklistContextProgram[] = resolved.map((r) => ({
        program_id: r.pick.programId,
        tier: r.pick.tier,
        program_name:
            r.candidate.program.name_zh ?? r.candidate.program.name_en,
        university_name:
            r.candidate.university.name_zh ?? r.candidate.university.name_en,
        country: COUNTRY_LABEL[r.candidate.university.country],
        level: r.candidate.program.level,
        language_requirement: `IELTS ${r.candidate.program.language_min.ielts_overall}`,
    }));
    const result = await generatePlanChecklist({
        locale: locale === "en" ? "en" : "zh",
        programs,
        generate: buildGooglePlanChecklistGenerator(),
    });
    if (!result.ok) {
        return {
            checklist: null,
            error: "AI 暂时不可用，可联系顾问拿模板。",
        };
    }
    return { checklist: result.value };
}

function EmptyPicksState({ code, locale: _locale }: { code: string; locale: string }) {
    return (
        <main className="bg-bg min-h-screen w-full px-6 py-16 sm:px-12">
            <div className="mx-auto max-w-2xl space-y-4">
                <h1 className="text-text text-2xl font-semibold">
                    还没有选定 6 所
                </h1>
                <p className="text-text-muted text-sm">
                    请先回到选校页挑出 2 冲 / 3 稳 / 1 保。
                </p>
                <Link
                    href={`/r/${code}/select`}
                    className="inline-block px-4 py-2 text-sm font-semibold text-white"
                    style={{
                        background: "var(--gradient-primary)",
                        borderRadius: "var(--radius-button)",
                        boxShadow: "var(--shadow-clay-raised)",
                    }}
                >
                    去选校
                </Link>
            </div>
        </main>
    );
}
