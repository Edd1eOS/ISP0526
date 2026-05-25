"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startIntakeFromTextAction } from "../intake-upload/upload-actions";

interface Prompt {
    readonly id: string;
    readonly title: string;
    readonly subtitle: string;
    readonly placeholder: string;
    readonly hints: ReadonlyArray<string>;
}

const PROMPTS: ReadonlyArray<Prompt> = [
    {
        id: "background",
        title: "你现在的学习/学术背景？",
        subtitle: "用一段话告诉我，越具体越好。",
        placeholder:
            "例：我在上海读大三，金融专业，GPA 3.6/4.0，雅思 6.5（小分 6.0）。\n大学期间做过一段券商研究所的实习，参与过 ESG 评级相关的研究。",
        hints: ["专业 / 学校", "GPA", "语言成绩", "实习 / 项目经历"],
    },
    {
        id: "goal",
        title: "你想去读什么？为什么？",
        subtitle: "申请方向、国家、心仪学校，想到哪写到哪。",
        placeholder:
            "例：想去澳洲读研，目标是商科相关，特别是金融或商业分析。\n选澳洲是因为家里在悉尼有亲戚可以照应，也想毕业后试试澳洲的工作机会。\n比较关注的是墨大、悉尼大学这种综合实力强的。",
        hints: ["目标国家 / 城市", "学位层次", "专业方向", "动机 / 期待"],
    },
    {
        id: "constraints",
        title: "现实条件和偏好？",
        subtitle: "预算、地点、住宿、节奏——把限制说清楚，AI 才能帮你筛。",
        placeholder:
            "例：家里能支持的预算大概一年 30-35 万人民币（学费+生活费）。\n更喜欢大城市，怕太安静的地方。希望两年内毕业，不太想读三年。",
        hints: ["年预算", "城市规模", "时长偏好", "教学方式"],
    },
];

export function ChatIntake() {
    const router = useRouter();
    const [step, setStep] = useState(0);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const total = PROMPTS.length;
    const current = PROMPTS[step]!;
    const value = answers[current.id] ?? "";
    const isLast = step === total - 1;
    const filledCount = PROMPTS.filter((p) => (answers[p.id] ?? "").trim().length > 0).length;
    const canAdvance = value.trim().length >= 4;

    const next = () => {
        if (!canAdvance) return;
        if (isLast) {
            void submit();
        } else {
            setStep((s) => Math.min(s + 1, total - 1));
        }
    };
    const back = () => setStep((s) => Math.max(s - 1, 0));

    const submit = async () => {
        setSubmitting(true);
        setError(null);
        try {
            const transcript = PROMPTS
                .map((p) => {
                    const a = (answers[p.id] ?? "").trim();
                    if (!a) return null;
                    return `Q: ${p.title}\nA: ${a}`;
                })
                .filter((x): x is string => x !== null)
                .join("\n\n");

            const label = `自述聊天 · ${new Date().toLocaleDateString("zh-CN")}`;
            const result = await startIntakeFromTextAction({
                source: "chat",
                label,
                text: transcript,
            });
            if (!result.ok || !result.sessionId) {
                setError(result.error ?? "抽取失败，请再试一次。");
                setSubmitting(false);
                return;
            }
            router.push(`/intake/review/${result.sessionId}`);
        } catch (cause) {
            // eslint-disable-next-line no-console
            console.error("[chat-intake] submit failed", cause);
            setError("出错了，再试一次？");
            setSubmitting(false);
        }
    };

    return (
        <div className="mx-auto w-full max-w-2xl space-y-6">
            <div className="flex items-center justify-center gap-2">
                {PROMPTS.map((p, i) => {
                    const reached = i <= step;
                    const filled = (answers[p.id] ?? "").trim().length > 0;
                    return (
                        <button
                            key={p.id}
                            type="button"
                            onClick={() => setStep(i)}
                            aria-label={`跳到第 ${i + 1} 步`}
                            className="h-2.5 transition-all"
                            style={{
                                width: i === step ? 28 : 10,
                                borderRadius: 999,
                                background: filled
                                    ? "var(--gradient-primary)"
                                    : reached
                                        ? "var(--color-text-muted)"
                                        : "var(--color-surface-alt)",
                                opacity: filled ? 1 : 0.6,
                            }}
                        />
                    );
                })}
            </div>

            <div
                key={current.id}
                className="card-slide-in p-7 sm:p-8"
                style={{
                    background: "var(--color-surface)",
                    borderRadius: "var(--radius-card-md)",
                    boxShadow: "var(--shadow-clay-card)",
                }}
            >
                <div className="space-y-2">
                    <span className="text-text-muted text-xs uppercase tracking-widest">
                        第 {step + 1} / {total} 问
                    </span>
                    <h2 className="text-text text-2xl font-semibold">{current.title}</h2>
                    <p className="text-text-muted text-sm">{current.subtitle}</p>
                </div>

                <div className="mt-4 flex flex-wrap gap-1.5">
                    {current.hints.map((h) => (
                        <span
                            key={h}
                            className="text-text-muted px-2 py-0.5 text-[11px]"
                            style={{
                                background: "var(--color-surface-alt)",
                                borderRadius: 999,
                            }}
                        >
                            {h}
                        </span>
                    ))}
                </div>

                <textarea
                    value={value}
                    onChange={(e) =>
                        setAnswers((prev) => ({ ...prev, [current.id]: e.target.value }))
                    }
                    placeholder={current.placeholder}
                    rows={8}
                    className="text-text mt-5 w-full resize-y p-4 text-sm leading-relaxed outline-none transition-shadow focus:shadow-[var(--shadow-clay-primary)]"
                    style={{
                        background: "var(--color-surface-alt)",
                        borderRadius: "var(--radius-card-sm)",
                        boxShadow: "var(--shadow-clay-inset)",
                    }}
                />

                <div className="text-text-muted mt-2 text-[11px]">
                    {value.trim().length === 0
                        ? "至少写一两句，AI 才能抓到信号。"
                        : value.trim().length < 4
                            ? "再多说一点？"
                            : `${value.trim().length} 字`}
                </div>

                {error ? (
                    <p className="mt-3 text-sm" style={{ color: "var(--color-danger)" }}>
                        {error}
                    </p>
                ) : null}

                <div className="mt-6 flex items-center justify-between gap-3">
                    <button
                        type="button"
                        onClick={back}
                        disabled={step === 0 || submitting}
                        className="text-text-muted px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-30"
                    >
                        上一题
                    </button>

                    <button
                        type="button"
                        onClick={next}
                        disabled={!canAdvance || submitting}
                        className="text-text-on-primary px-5 py-2.5 text-sm font-semibold transition-transform active:scale-95 disabled:opacity-50"
                        style={{
                            background: "var(--gradient-primary)",
                            borderRadius: "var(--radius-button)",
                            boxShadow: "var(--shadow-clay-primary)",
                        }}
                    >
                        {submitting
                            ? "AI 整理中…"
                            : isLast
                                ? `生成报告（已填 ${filledCount}/${total}）`
                                : "下一题"}
                    </button>
                </div>
            </div>

            <p className="text-text-muted text-center text-xs">
                想跳过某题？点上方圆点直接跳。AI 会用你写的内容抽取字段，下一步可以核对。
            </p>
        </div>
    );
}
