"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "../../i18n/navigation";
import { trackEvent } from "../../lib/analytics/track";
import {
    LIKERT_LABELS,
    PREF_ITEMS,
    RIASEC_ITEMS,
    TIPI_ITEMS,
    type AssessmentAnswers,
    type LikertValue,
    type PrefItem,
    type PrefItemId,
    type RiasecItem,
    type TipiDim,
    type TipiItem,
} from "./items";

const ASSESSMENT_KEY = "isp_assessment_v1";
const ADVANCE_DELAY_MS = 240;

const TIPI_DIM_ZH: Record<TipiDim, string> = {
    openness: "开放性",
    conscientiousness: "尽责性",
    extraversion: "外向性",
    agreeableness: "宜人性",
    neuroticism: "情绪稳定性",
};

function tipiDimLabel(dim: TipiDim): string {
    return TIPI_DIM_ZH[dim];
}

type Step =
    | { readonly kind: "tipi"; readonly item: TipiItem }
    | { readonly kind: "riasec"; readonly item: RiasecItem }
    | { readonly kind: "pref"; readonly item: PrefItem };

function buildSteps(): ReadonlyArray<Step> {
    const tipi: Step[] = TIPI_ITEMS.map((item) => ({ kind: "tipi", item }));
    const riasec: Step[] = RIASEC_ITEMS.map((item) => ({
        kind: "riasec",
        item,
    }));
    const prefs: Step[] = PREF_ITEMS.map((item) => ({ kind: "pref", item }));
    return [...tipi, ...riasec, ...prefs];
}

type AnswerMap = {
    tipi: Record<string, LikertValue>;
    riasec: Record<string, LikertValue>;
    prefs: Partial<Record<PrefItemId, LikertValue | string>>;
};

export function AssessmentFlow() {
    const router = useRouter();
    const steps = useMemo(() => buildSteps(), []);
    const [cursor, setCursor] = useState(0);
    const [answers, setAnswers] = useState<AnswerMap>({
        tipi: {},
        riasec: {},
        prefs: {},
    });
    const [advancing, setAdvancing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [, startTransition] = useTransition();

    useEffect(() => {
        trackEvent("intake_step_start", { channel: "assessment", step: 0 });
    }, []);

    const total = steps.length;
    const step = steps[cursor];
    const isLast = cursor === total - 1;

    const currentValue: LikertValue | string | undefined = useMemo(() => {
        if (!step) return undefined;
        if (step.kind === "tipi") return answers.tipi[step.item.id];
        if (step.kind === "riasec") return answers.riasec[step.item.id];
        return answers.prefs[step.item.id];
    }, [step, answers]);

    const goBack = () => {
        if (cursor > 0) setCursor((c) => c - 1);
    };

    const choose = (value: LikertValue | string) => {
        if (advancing || !step) return;
        setAnswers((s) => {
            if (step.kind === "tipi") {
                return {
                    ...s,
                    tipi: { ...s.tipi, [step.item.id]: value as LikertValue },
                };
            }
            if (step.kind === "riasec") {
                return {
                    ...s,
                    riasec: {
                        ...s.riasec,
                        [step.item.id]: value as LikertValue,
                    },
                };
            }
            return { ...s, prefs: { ...s.prefs, [step.item.id]: value } };
        });
        if (isLast) return;
        setAdvancing(true);
        window.setTimeout(() => {
            setCursor((c) => Math.min(c + 1, total - 1));
            setAdvancing(false);
        }, ADVANCE_DELAY_MS);
    };

    const allAnswered = useMemo(() => {
        const tipiDone = TIPI_ITEMS.every(
            (it) => answers.tipi[it.id] !== undefined,
        );
        const riasecDone = RIASEC_ITEMS.every(
            (it) => answers.riasec[it.id] !== undefined,
        );
        const prefsDone = PREF_ITEMS.every(
            (it) => answers.prefs[it.id] !== undefined,
        );
        return tipiDone && riasecDone && prefsDone;
    }, [answers]);

    const onFinish = () => {
        if (!allAnswered) {
            setError("还有题目没答，往回翻一下补上吧。");
            return;
        }
        setError(null);
        const payload: AssessmentAnswers = {
            tipi: answers.tipi,
            riasec: answers.riasec,
            prefs: answers.prefs as Record<PrefItemId, LikertValue | string>,
        };
        try {
            window.sessionStorage.setItem(
                ASSESSMENT_KEY,
                JSON.stringify(payload),
            );
        } catch (cause) {
            // eslint-disable-next-line no-console
            console.warn("[assessment] sessionStorage write failed", cause);
        }
        trackEvent("intake_step_start", { channel: "assessment", step: 1 });
        startTransition(() => {
            router.push("/intake/assessment/result");
        });
    };

    if (!step) return null;

    const sectionTag =
        step.kind === "tipi"
            ? `Big Five · ${tipiDimLabel(step.item.dim)}`
            : step.kind === "riasec"
                ? "Holland 职业兴趣·RIASEC"
                : "学习 / 生活偏好";
    const progressPct = Math.round(((cursor + 1) / total) * 100);

    return (
        <main className="bg-bg min-h-screen w-full">
            <div className="mx-auto flex min-h-screen max-w-xl flex-col px-4 py-6 sm:px-6 sm:py-10">
                <ProgressHeader
                    cursor={cursor}
                    total={total}
                    pct={progressPct}
                    canBack={cursor > 0}
                    onBack={goBack}
                />

                <p
                    className="text-text-muted mt-3 text-center text-[11px] leading-relaxed"
                    style={{ letterSpacing: "0.02em" }}
                >
                    基于 Big Five 人格量表（TIPI · Gosling, Rentfrow &amp; Swann, 2003）＋Holland 职业兴趣框架（1959）＋学习/生活偏好量表
                </p>

                <div key={cursor} className="mt-8 flex-1" style={{ animation: "isp-fade-up 220ms ease-out" }}>
                    <p className="text-text-muted text-xs uppercase tracking-widest">
                        {sectionTag} · {cursor + 1} / {total}
                    </p>
                    <h2 className="text-text mt-3 text-2xl font-semibold leading-snug sm:text-3xl">
                        {step.item.prompt}
                    </h2>
                    <p className="text-text-muted mt-3 text-sm">
                        没有对错，凭直觉选一个就行。
                    </p>

                    <div className="mt-8">
                        {step.kind === "tipi" || step.kind === "riasec" ? (
                            <LikertChoices
                                value={
                                    typeof currentValue === "number"
                                        ? (currentValue as LikertValue)
                                        : undefined
                                }
                                onChoose={(v) => choose(v)}
                            />
                        ) : step.item.kind === "likert" ? (
                            <LikertChoices
                                value={
                                    typeof currentValue === "number"
                                        ? (currentValue as LikertValue)
                                        : undefined
                                }
                                onChoose={(v) => choose(v)}
                                lowLabel={step.item.low}
                                highLabel={step.item.high}
                            />
                        ) : (
                            <EnumChoices
                                options={step.item.options}
                                value={
                                    typeof currentValue === "string"
                                        ? currentValue
                                        : undefined
                                }
                                onChoose={(v) => choose(v)}
                            />
                        )}
                    </div>
                </div>

                {error ? (
                    <p className="mt-4 text-center text-sm text-red-600">
                        {error}
                    </p>
                ) : null}

                {isLast ? (
                    <button
                        type="button"
                        onClick={onFinish}
                        disabled={!allAnswered}
                        className="mt-8 w-full px-4 py-4 text-base font-semibold transition-transform active:scale-95 disabled:opacity-50"
                        style={{
                            background: "var(--gradient-primary)",
                            borderRadius: "var(--radius-button)",
                            boxShadow: "var(--shadow-clay-primary)",
                            color: "var(--color-text-on-primary)",
                        }}
                    >
                        完成，查看测评报告
                    </button>
                ) : null}

                <p className="text-text-muted mt-6 text-center text-xs">
                    所有答案仅用于生成你这份推荐，不会用作他用。测评结果会同步给接下来聊天的顾问，不用重说一遍。
                </p>
            </div>

            <style>{`
                @keyframes isp-fade-up {
                    from { opacity: 0; transform: translateY(8px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </main>
    );
}

interface ProgressHeaderProps {
    readonly cursor: number;
    readonly total: number;
    readonly pct: number;
    readonly canBack: boolean;
    readonly onBack: () => void;
}

function ProgressHeader({
    cursor,
    total,
    pct,
    canBack,
    onBack,
}: ProgressHeaderProps) {
    return (
        <div className="flex items-center gap-3">
            <button
                type="button"
                onClick={onBack}
                disabled={!canBack}
                aria-label="上一题"
                className="text-text flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base transition-transform active:scale-95 disabled:opacity-30"
                style={{
                    background: "var(--color-surface)",
                    boxShadow: "var(--shadow-clay-sm)",
                }}
            >
                <span aria-hidden>{"<"}</span>
            </button>
            <div className="flex-1">
                <div
                    className="h-2 w-full overflow-hidden rounded-full"
                    style={{ background: "rgba(0,0,0,0.06)" }}
                >
                    <div
                        className="h-full transition-all duration-300"
                        style={{
                            width: `${pct}%`,
                            background: "var(--gradient-primary)",
                        }}
                    />
                </div>
            </div>
            <span className="text-text-muted text-xs tabular-nums">
                {cursor + 1}/{total}
            </span>
        </div>
    );
}

interface LikertChoicesProps {
    readonly value: LikertValue | undefined;
    readonly onChoose: (v: LikertValue) => void;
    readonly lowLabel?: string;
    readonly highLabel?: string;
}

function LikertChoices({
    value,
    onChoose,
    lowLabel,
    highLabel,
}: LikertChoicesProps) {
    return (
        <div className="space-y-2">
            {([5, 4, 3, 2, 1] as ReadonlyArray<LikertValue>).map((v) => {
                const selected = value === v;
                return (
                    <button
                        key={v}
                        type="button"
                        onClick={() => onChoose(v)}
                        className="flex w-full items-center justify-between px-5 py-4 text-left text-base font-medium transition-transform active:scale-[0.98]"
                        style={{
                            background: selected
                                ? "var(--gradient-primary)"
                                : "var(--color-surface)",
                            borderRadius: "var(--radius-card-md)",
                            boxShadow: selected
                                ? "var(--shadow-clay-primary)"
                                : "var(--shadow-clay-sm)",
                            color: selected
                                ? "var(--color-text-on-primary)"
                                : "var(--color-text)",
                        }}
                        aria-pressed={selected}
                    >
                        <span>{LIKERT_LABELS[v - 1]}</span>
                        <span
                            className="text-xs tabular-nums opacity-60"
                            aria-hidden
                        >
                            {v}
                        </span>
                    </button>
                );
            })}
            {(lowLabel || highLabel) && (
                <div className="text-text-muted mt-3 flex justify-between text-[11px]">
                    <span>5 = {highLabel ?? ""}</span>
                    <span>1 = {lowLabel ?? ""}</span>
                </div>
            )}
        </div>
    );
}

interface EnumChoicesProps {
    readonly options: ReadonlyArray<{ value: string; label: string }>;
    readonly value: string | undefined;
    readonly onChoose: (v: string) => void;
}

function EnumChoices({ options, value, onChoose }: EnumChoicesProps) {
    return (
        <div className="space-y-2">
            {options.map((opt) => {
                const selected = value === opt.value;
                return (
                    <button
                        key={opt.value}
                        type="button"
                        onClick={() => onChoose(opt.value)}
                        className="flex w-full items-center justify-between px-5 py-4 text-left text-base font-medium transition-transform active:scale-[0.98]"
                        style={{
                            background: selected
                                ? "var(--gradient-primary)"
                                : "var(--color-surface)",
                            borderRadius: "var(--radius-card-md)",
                            boxShadow: selected
                                ? "var(--shadow-clay-primary)"
                                : "var(--shadow-clay-sm)",
                            color: selected
                                ? "var(--color-text-on-primary)"
                                : "var(--color-text)",
                        }}
                        aria-pressed={selected}
                    >
                        {opt.label}
                    </button>
                );
            })}
        </div>
    );
}
