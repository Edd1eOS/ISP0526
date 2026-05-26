"use client";

// Result-review surface shown after the 21-question assessment finishes and
// before the chat handoff. The student sees their own quantified profile:
// Big Five bars (TIPI / Gosling, Rentfrow & Swann, 2003), top RIASEC
// interests (Holland, 1959), plus the explicit learning + lifestyle answers
// they gave. Click-through routes to /intake/chat which then seeds the
// LLM with the same scored payload via sessionStorage isp_assessment_v1.

import { useEffect, useMemo, useState, useTransition } from "react";
import type { ReactNode } from "react";
import { useRouter } from "../../i18n/navigation";
import { trackEvent } from "../../lib/analytics/track";
import {
    RIASEC_ITEMS,
    scoreAssessment,
    type AssessmentAnswers,
    type RiasecDim,
} from "./items";
import type { BigFive, CareerInterests } from "@isp0526/core";

const ASSESSMENT_KEY = "isp_assessment_v1";

const BIG_FIVE_LABELS: ReadonlyArray<{
    key: keyof BigFive;
    label: string;
    blurb: string;
    invert?: boolean;
}> = [
        { key: "extraversion", label: "外向性", blurb: "和人打交道、参与活动的能量" },
        { key: "agreeableness", label: "宜人性", blurb: "合作、共情和给他人空间的倾向" },
        { key: "conscientiousness", label: "尽责性", blurb: "计划性、自律和执行力" },
        {
            key: "neuroticism",
            label: "情绪稳定性",
            blurb: "面对压力时的稳态（数值越高越稳）",
            invert: true,
        },
        { key: "openness", label: "开放性", blurb: "对新观念、新体验的兴趣" },
    ];

const RIASEC_LABELS: Record<RiasecDim, { label: string; blurb: string }> = {
    realistic: { label: "现实型 R", blurb: "动手操作、工具、机械、户外" },
    investigative: {
        label: "研究型 I",
        blurb: "分析问题、做实验、追求事物原理",
    },
    artistic: { label: "艺术型 A", blurb: "创作、设计、表达、自由发挥" },
    social: { label: "社会型 S", blurb: "与人协作、帮助、教导、协调" },
    enterprising: {
        label: "企业型 E",
        blurb: "说服、领导、谈判、追求商业成果",
    },
    conventional: {
        label: "常规型 C",
        blurb: "结构化、按规则把事情整理清楚",
    },
};

const TEACHING_STYLE_LABEL: Record<string, string> = {
    theory_heavy: "偏理论",
    balanced: "都行",
    applied_heavy: "偏实践",
};

const CITY_SIZE_LABEL: Record<string, string> = {
    mega: "超大城市",
    large: "大城市",
    medium: "中等城市",
    small: "小城市",
};

function readAssessment(): AssessmentAnswers | undefined {
    if (typeof window === "undefined") return undefined;
    try {
        const raw = window.sessionStorage.getItem(ASSESSMENT_KEY);
        if (!raw) return undefined;
        return JSON.parse(raw) as AssessmentAnswers;
    } catch {
        return undefined;
    }
}

export function AssessmentResultReview() {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [answers, setAnswers] = useState<AssessmentAnswers | undefined>(
        undefined,
    );
    const [missing, setMissing] = useState(false);

    useEffect(() => {
        const a = readAssessment();
        if (!a) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setMissing(true);
            return;
        }
        setAnswers(a);
        trackEvent("intake_step_start", {
            channel: "assessment",
            step: 2,
        });
    }, []);

    const scored = useMemo(
        () => (answers ? scoreAssessment(answers) : undefined),
        [answers],
    );

    const topRiasec = useMemo(() => {
        const interests = scored?.career.interests as
            | CareerInterests
            | undefined;
        if (!interests) return [];
        const entries = (Object.entries(interests) as Array<
            [RiasecDim, number | undefined]
        >).filter((e): e is [RiasecDim, number] => typeof e[1] === "number");
        entries.sort((a, b) => b[1] - a[1]);
        return entries.slice(0, 3);
    }, [scored]);

    const onContinue = () => {
        trackEvent("intake_step_start", { channel: "chat", step: 0 });
        startTransition(() => {
            router.push("/intake/chat");
        });
    };

    if (missing) {
        return (
            <main className="bg-bg min-h-screen w-full">
                <div className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-4 py-10">
                    <p className="text-text text-sm">
                        没找到测评答案，回去先做一遍测评吧。
                    </p>
                    <button
                        type="button"
                        onClick={() => router.push("/intake/assessment")}
                        className="mt-4 px-4 py-2 text-sm font-semibold"
                        style={{
                            background: "var(--gradient-primary)",
                            color: "var(--color-text-on-primary)",
                            borderRadius: "var(--radius-button)",
                            boxShadow: "var(--shadow-clay-primary)",
                        }}
                    >
                        去做测评
                    </button>
                </div>
            </main>
        );
    }

    if (!scored) {
        return (
            <main className="bg-bg min-h-screen w-full">
                <div className="mx-auto flex min-h-screen max-w-xl items-center justify-center px-4 py-10">
                    <p className="text-text-muted text-sm">读取你的答案中…</p>
                </div>
            </main>
        );
    }

    const b = scored.big_five;
    return (
        <main className="bg-bg min-h-screen w-full">
            <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 py-8 sm:px-6 sm:py-12">
                <header className="text-center">
                    <p
                        className="text-text-muted text-[11px] uppercase tracking-widest"
                    >
                        Step 1 · 测评报告
                    </p>
                    <h1 className="text-text mt-2 text-2xl font-semibold sm:text-3xl">
                        这是你刚才那 21 题量化出来的样子
                    </h1>
                    <p className="text-text-muted mt-2 text-xs leading-relaxed">
                        基于 Big Five 人格量表（TIPI · Gosling, Rentfrow &amp;
                        Swann, 2003） + Holland 职业兴趣框架（1959）+ 学习/生活偏好量表
                    </p>
                </header>

                <Section title="人格画像 · Big Five">
                    <div className="space-y-3">
                        {BIG_FIVE_LABELS.map(({ key, label, blurb, invert }) => {
                            const raw = b[key];
                            const shown = invert ? 7 - raw : raw;
                            const pct = (shown / 7) * 100;
                            return (
                                <Bar
                                    key={key}
                                    label={label}
                                    blurb={blurb}
                                    pct={pct}
                                    valueText={`${shown.toFixed(1)} / 7`}
                                />
                            );
                        })}
                    </div>
                </Section>

                {topRiasec.length > 0 ? (
                    <Section title="职业兴趣 · Holland RIASEC">
                        <p className="text-text-muted mb-3 text-xs">
                            前三高的兴趣方向（不是“你只能做这个”，而是“你做起来更顺手”）：
                        </p>
                        <div className="space-y-3">
                            {topRiasec.map(([dim, score]) => (
                                <Bar
                                    key={dim}
                                    label={RIASEC_LABELS[dim].label}
                                    blurb={RIASEC_LABELS[dim].blurb}
                                    pct={score * 100}
                                    valueText={`${Math.round(score * 100)}%`}
                                    accent
                                />
                            ))}
                        </div>
                        <details className="mt-3 text-xs">
                            <summary
                                className="cursor-pointer"
                                style={{ color: "var(--color-text-muted)" }}
                            >
                                展开六维全部分值
                            </summary>
                            <div className="mt-2 space-y-2">
                                {RIASEC_ITEMS.map((item) => {
                                    const score =
                                        (
                                            scored.career.interests as
                                            | CareerInterests
                                            | undefined
                                        )?.[item.dim] ?? 0;
                                    return (
                                        <Bar
                                            key={item.dim}
                                            label={
                                                RIASEC_LABELS[item.dim].label
                                            }
                                            blurb=""
                                            pct={score * 100}
                                            valueText={`${Math.round(score * 100)}%`}
                                            compact
                                        />
                                    );
                                })}
                            </div>
                        </details>
                    </Section>
                ) : null}

                <Section title="学习与生活偏好">
                    <ul className="space-y-2 text-sm">
                        {scored.learning.teaching_style ? (
                            <PrefRow
                                k="教学风格"
                                v={
                                    TEACHING_STYLE_LABEL[
                                    scored.learning.teaching_style
                                    ] ?? scored.learning.teaching_style
                                }
                            />
                        ) : null}
                        {scored.learning.class_size_small ? (
                            <PrefRow
                                k="班级规模偏好（5 = 越小越好）"
                                v={`${scored.learning.class_size_small} / 5`}
                            />
                        ) : null}
                        {scored.learning.fast_pace ? (
                            <PrefRow
                                k="学习节奏（5 = 越紧凑越好）"
                                v={`${scored.learning.fast_pace} / 5`}
                            />
                        ) : null}
                        {scored.lifestyle.city_size ? (
                            <PrefRow
                                k="城市规模"
                                v={
                                    CITY_SIZE_LABEL[
                                    scored.lifestyle.city_size
                                    ] ?? scored.lifestyle.city_size
                                }
                            />
                        ) : null}
                        {scored.career.migration_intent ? (
                            <PrefRow
                                k="毕业后留下意愿（5 = 很想留）"
                                v={`${scored.career.migration_intent} / 5`}
                            />
                        ) : null}
                    </ul>
                </Section>

                <p className="text-text-muted mt-6 text-center text-xs leading-relaxed">
                    这份测评结果会同步给接下来的顾问，他不会再让你重答一遍。
                </p>

                <button
                    type="button"
                    onClick={onContinue}
                    disabled={pending}
                    className="mt-6 w-full px-4 py-4 text-base font-semibold transition-transform active:scale-95 disabled:opacity-50"
                    style={{
                        background: "var(--gradient-primary)",
                        borderRadius: "var(--radius-button)",
                        boxShadow: "var(--shadow-clay-primary)",
                        color: "var(--color-text-on-primary)",
                    }}
                >
                    {pending ? "正在跳转…" : "去聊聊，给我推荐"}
                </button>
            </div>
        </main>
    );
}

function Section({
    title,
    children,
}: {
    title: string;
    children: ReactNode;
}) {
    return (
        <section
            className="mt-6 px-4 py-4 sm:px-5"
            style={{
                background: "var(--color-surface)",
                borderRadius: "var(--radius-card-md)",
                boxShadow: "var(--shadow-clay-card)",
            }}
        >
            <h2 className="text-text text-sm font-semibold">{title}</h2>
            <div className="mt-3">{children}</div>
        </section>
    );
}

function Bar({
    label,
    blurb,
    pct,
    valueText,
    accent,
    compact,
}: {
    label: string;
    blurb: string;
    pct: number;
    valueText: string;
    accent?: boolean;
    compact?: boolean;
}) {
    const clamped = Math.max(0, Math.min(100, pct));
    return (
        <div>
            <div className="flex items-baseline justify-between gap-2">
                <span
                    className="text-text font-medium"
                    style={{ fontSize: compact ? 12 : 13 }}
                >
                    {label}
                </span>
                <span
                    className="text-text-muted"
                    style={{ fontSize: compact ? 11 : 12 }}
                >
                    {valueText}
                </span>
            </div>
            {blurb ? (
                <p
                    className="text-text-muted mt-0.5"
                    style={{ fontSize: 11 }}
                >
                    {blurb}
                </p>
            ) : null}
            <div
                className="mt-1.5 h-2 w-full overflow-hidden"
                style={{
                    background: "var(--color-surface-alt)",
                    borderRadius: 999,
                }}
                aria-hidden
            >
                <div
                    className="h-full transition-all"
                    style={{
                        width: `${clamped}%`,
                        background: accent
                            ? "var(--gradient-accent, var(--gradient-primary))"
                            : "var(--gradient-primary)",
                    }}
                />
            </div>
        </div>
    );
}

function PrefRow({ k, v }: { k: string; v: string }) {
    return (
        <li className="flex items-center justify-between gap-3">
            <span className="text-text-muted text-xs">{k}</span>
            <span className="text-text text-xs font-medium">{v}</span>
        </li>
    );
}
