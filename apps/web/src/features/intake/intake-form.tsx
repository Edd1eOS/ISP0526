"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { trackEvent } from "../../lib/analytics/track";
import { FIELD_OPTIONS } from "./field-options";

interface IntakeFormProps {
    readonly action: (formData: FormData) => Promise<void>;
}

// Values use AUD internally (server contract); the budget slider speaks
// RMB and is converted just-in-time so users see familiar numbers.
type Values = {
    target_level: "foundation" | "pathway" | "diploma" | "bachelor" | "master" | "phd";
    target_field: string;
    gpa: number | null;
    ielts_overall: number | null;
    teaching_style: "" | "theory_heavy" | "balanced" | "applied_heavy";
    city_size: "" | "mega" | "large" | "medium" | "small";
    annual_budget_rmb: number | null;
    preferred_tags: ReadonlyArray<string>;
};

const DEFAULTS: Values = {
    target_level: "master",
    target_field: "",
    gpa: null,
    ielts_overall: null,
    teaching_style: "",
    city_size: "",
    annual_budget_rmb: null,
    preferred_tags: [],
};

const RMB_PER_AUD = 4.7;

const LEVEL_TILES = [
    { value: "master", label: "硕士", caption: "目前覆盖完整的数据集", enabled: true },
    { value: "bachelor", label: "本科", caption: "数据正在补齐", enabled: true },
    { value: "foundation", label: "预科", caption: "Foundation / 国际大一", enabled: false },
    { value: "pathway", label: "衔接", caption: "Pathway / 桥梁课程", enabled: false },
    { value: "diploma", label: "文凭", caption: "Diploma / 证书路径", enabled: false },
    { value: "phd", label: "博士", caption: "暂无项目数据", enabled: false },
] as const;

const STYLE_PILLS = [
    { value: "", label: "没想好" },
    { value: "theory_heavy", label: "偏理论" },
    { value: "balanced", label: "平衡" },
    { value: "applied_heavy", label: "偏实践" },
] as const;

const CITY_TILES = [
    { value: "", label: "都行" },
    { value: "mega", label: "超大城市", caption: "悉尼 / 墨尔本" },
    { value: "large", label: "大城市", caption: "布里斯班 / 珀斯" },
    { value: "medium", label: "中等城市", caption: "黄金海岸 / 堪培拉" },
    { value: "small", label: "小城市", caption: "霍巴特 / 达尔文" },
] as const;

const TAGS = [
    { value: "field_top", label: "学科顶尖" },
    { value: "migration_friendly", label: "利于移民" },
    { value: "career_pipeline", label: "就业渠道" },
    { value: "value_for_money", label: "性价比" },
    { value: "scholarship_rich", label: "奖学金多" },
    { value: "chinese_community", label: "华人社区活跃" },
] as const;

interface StepDef {
    readonly key: keyof Values;
    readonly title: string;
    readonly hint?: string;
    readonly required?: boolean;
}

const STEPS: ReadonlyArray<StepDef> = [
    { key: "target_level", title: "想读哪个学位？", hint: "目前只有硕士数据完整，其他先占位。", required: true },
    { key: "target_field", title: "想读什么方向？", hint: "选最接近的一个，跳过也行。" },
    { key: "gpa", title: "GPA 大概是？", hint: "拖一下滑块；不知道就跳过。" },
    { key: "ielts_overall", title: "雅思总分？", hint: "现在的或目标分都行。" },
    { key: "teaching_style", title: "喜欢的学习风格？" },
    { key: "city_size", title: "想去多大的城市？" },
    { key: "annual_budget_rmb", title: "一年的预算（人民币）？", hint: "学费 + 生活；后台会按 ¥4.7 换算成 AUD。" },
    { key: "preferred_tags", title: "最在意哪几件事？", hint: "可多选，建议挑 1–3 个最重要的。" },
];

export function IntakeForm({ action }: IntakeFormProps) {
    const [step, setStep] = useState(0);
    const [direction, setDirection] = useState<1 | -1>(1);
    const [values, setValues] = useState<Values>(DEFAULTS);
    const [pending, startTransition] = useTransition();

    const current = STEPS[step];
    const isLast = step === STEPS.length - 1;

    const canNext = useMemo(() => {
        if (!current.required) return true;
        const v = values[current.key];
        if (v === null || v === "" || (Array.isArray(v) && v.length === 0)) {
            return false;
        }
        return true;
    }, [current, values]);

    useEffect(() => {
        trackEvent("intake_step_start", {
            channel: "form",
            step,
            key: STEPS[step]!.key,
        });
    }, [step]);

    const goNext = () => {
        if (step < STEPS.length - 1) {
            const v = values[current.key];
            const filled =
                v !== null && v !== "" && !(Array.isArray(v) && v.length === 0);
            trackEvent(
                filled ? "intake_step_complete" : "intake_step_skip",
                { channel: "form", step, key: current.key },
            );
            setDirection(1);
            setStep(step + 1);
        }
    };
    const goBack = () => {
        if (step > 0) {
            setDirection(-1);
            setStep(step - 1);
        }
    };

    const submit = () => {
        const fd = new FormData();
        fd.set("target_level", values.target_level);
        if (values.target_field) fd.set("target_field", values.target_field);
        if (values.gpa !== null) fd.set("gpa", String(values.gpa));
        if (values.ielts_overall !== null) fd.set("ielts_overall", String(values.ielts_overall));
        if (values.teaching_style) fd.set("teaching_style", values.teaching_style);
        if (values.city_size) fd.set("city_size", values.city_size);
        if (values.annual_budget_rmb !== null) {
            const aud = Math.round(values.annual_budget_rmb / RMB_PER_AUD);
            fd.set("annual_budget_aud", String(aud));
        }
        values.preferred_tags.forEach((t) => fd.append("preferred_tags", t));
        trackEvent("intake_submitted", { channel: "form" });
        startTransition(() => {
            void action(fd);
        });
    };

    return (
        <div className="space-y-8">
            <ProgressDots total={STEPS.length} current={step} onJump={(i) => {
                setDirection(i > step ? 1 : -1);
                setStep(i);
            }} />

            <div className="relative min-h-[360px] overflow-hidden">
                <div
                    key={step}
                    className="card-enter"
                    style={{
                        // CSS var consumed by keyframes so direction picks the right slide.
                        ["--slide-from" as string]: direction === 1 ? "32px" : "-32px",
                    }}
                >
                    <div
                        className="relative px-6 py-8 sm:px-10 sm:py-10"
                        style={{
                            background: "var(--gradient-raised)",
                            borderRadius: "var(--radius-card-md)",
                            boxShadow: "var(--shadow-clay-card)",
                        }}
                    >
                        <div className="space-y-2">
                            <span className="text-text-muted text-xs uppercase tracking-widest">
                                第 {step + 1} / {STEPS.length} 步
                            </span>
                            <h2 className="text-text text-2xl font-semibold leading-tight sm:text-3xl">
                                {current.title}
                                {current.required && <span className="text-warning"> *</span>}
                            </h2>
                            {current.hint && (
                                <p className="text-text-muted text-sm">{current.hint}</p>
                            )}
                        </div>

                        <div className="mt-8">
                            <StepBody
                                stepKey={current.key}
                                values={values}
                                setValues={setValues}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-between gap-3">
                <button
                    type="button"
                    onClick={goBack}
                    disabled={step === 0 || pending}
                    className="text-text-muted px-4 py-2 text-sm transition-opacity disabled:opacity-40"
                >
                    上一步
                </button>
                <div className="flex gap-2">
                    {!current.required && !isLast && (
                        <button
                            type="button"
                            onClick={goNext}
                            disabled={pending}
                            className="text-text-muted px-4 py-2 text-sm"
                        >
                            跳过
                        </button>
                    )}
                    {!isLast ? (
                        <button
                            type="button"
                            onClick={goNext}
                            disabled={!canNext || pending}
                            className="text-text-on-primary px-6 py-2.5 text-sm font-semibold transition-transform active:scale-95 disabled:opacity-50"
                            style={{
                                background: "var(--gradient-primary)",
                                borderRadius: "var(--radius-button)",
                                boxShadow: "var(--shadow-clay-primary)",
                            }}
                        >
                            下一步
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={submit}
                            disabled={!canNext || pending}
                            className="text-text-on-primary px-6 py-2.5 text-sm font-semibold transition-transform active:scale-95 disabled:opacity-50"
                            style={{
                                background: "var(--gradient-primary)",
                                borderRadius: "var(--radius-button)",
                                boxShadow: "var(--shadow-clay-primary)",
                            }}
                        >
                            {pending ? "正在生成报告…" : "生成我的推荐"}
                        </button>
                    )}
                </div>
            </div>

            <style>{`
                @keyframes card-slide-in {
                    from {
                        opacity: 0;
                        transform: translate3d(var(--slide-from, 32px), 0, 0);
                    }
                    to {
                        opacity: 1;
                        transform: translate3d(0, 0, 0);
                    }
                }
                .card-enter {
                    animation: card-slide-in 320ms cubic-bezier(0.22, 1, 0.36, 1) both;
                }
                @media (prefers-reduced-motion: reduce) {
                    .card-enter { animation: none; }
                }
            `}</style>
        </div>
    );
}

// ----- progress -----

function ProgressDots({
    total,
    current,
    onJump,
}: {
    total: number;
    current: number;
    onJump: (i: number) => void;
}) {
    return (
        <div className="flex items-center gap-2">
            {Array.from({ length: total }).map((_, i) => {
                const active = i === current;
                const done = i < current;
                return (
                    <button
                        key={i}
                        type="button"
                        onClick={() => onJump(i)}
                        aria-label={`跳到第 ${i + 1} 步`}
                        className="h-1.5 flex-1 rounded-full transition-all"
                        style={{
                            background: active
                                ? "var(--gradient-primary)"
                                : done
                                    ? "var(--color-primary-from)"
                                    : "var(--color-surface-alt)",
                            opacity: active ? 1 : done ? 0.55 : 1,
                        }}
                    />
                );
            })}
        </div>
    );
}

// ----- step bodies -----

function StepBody({
    stepKey,
    values,
    setValues,
}: {
    stepKey: keyof Values;
    values: Values;
    setValues: React.Dispatch<React.SetStateAction<Values>>;
}) {
    switch (stepKey) {
        case "target_level":
            return (
                <TileGrid
                    columns={3}
                    options={LEVEL_TILES.map((t) => ({
                        value: t.value,
                        label: t.label,
                        caption: t.caption,
                        disabled: !t.enabled,
                    }))}
                    selected={values.target_level}
                    onPick={(v) =>
                        setValues((s) => ({ ...s, target_level: v as Values["target_level"] }))
                    }
                />
            );

        case "target_field":
            return (
                <ChipGrid
                    options={FIELD_OPTIONS.filter((o) => o.value !== "").map((o) => ({
                        value: o.value,
                        label: o.label,
                    }))}
                    selected={values.target_field}
                    onPick={(v) =>
                        setValues((s) => ({
                            ...s,
                            target_field: s.target_field === v ? "" : v,
                        }))
                    }
                />
            );

        case "gpa":
            return (
                <SliderField
                    value={values.gpa}
                    min={2.0}
                    max={4.0}
                    step={0.05}
                    fallbackDefault={3.4}
                    formatValue={(v) => v.toFixed(2)}
                    suffix=" / 4.0"
                    onChange={(v) => setValues((s) => ({ ...s, gpa: v }))}
                    onClear={() => setValues((s) => ({ ...s, gpa: null }))}
                />
            );

        case "ielts_overall":
            return (
                <SliderField
                    value={values.ielts_overall}
                    min={4.0}
                    max={9.0}
                    step={0.5}
                    fallbackDefault={6.5}
                    formatValue={(v) => v.toFixed(1)}
                    suffix=" 分"
                    onChange={(v) => setValues((s) => ({ ...s, ielts_overall: v }))}
                    onClear={() => setValues((s) => ({ ...s, ielts_overall: null }))}
                />
            );

        case "teaching_style":
            return (
                <SegmentedPills
                    options={STYLE_PILLS}
                    selected={values.teaching_style}
                    onPick={(v) =>
                        setValues((s) => ({
                            ...s,
                            teaching_style: v as Values["teaching_style"],
                        }))
                    }
                />
            );

        case "city_size":
            return (
                <TileGrid
                    columns={2}
                    options={CITY_TILES.map((t) => ({
                        value: t.value,
                        label: t.label,
                        caption: "caption" in t ? t.caption : undefined,
                    }))}
                    selected={values.city_size}
                    onPick={(v) =>
                        setValues((s) => ({ ...s, city_size: v as Values["city_size"] }))
                    }
                />
            );

        case "annual_budget_rmb":
            return (
                <BudgetSlider
                    value={values.annual_budget_rmb}
                    onChange={(v) => setValues((s) => ({ ...s, annual_budget_rmb: v }))}
                    onClear={() => setValues((s) => ({ ...s, annual_budget_rmb: null }))}
                />
            );

        case "preferred_tags":
            return (
                <MultiChipGrid
                    options={TAGS}
                    selected={values.preferred_tags}
                    onToggle={(v) =>
                        setValues((s) => ({
                            ...s,
                            preferred_tags: s.preferred_tags.includes(v)
                                ? s.preferred_tags.filter((t) => t !== v)
                                : [...s.preferred_tags, v],
                        }))
                    }
                />
            );

        default:
            return null;
    }
}

// ----- interaction primitives -----

interface TileOption {
    readonly value: string;
    readonly label: string;
    readonly caption?: string;
    readonly disabled?: boolean;
}

function TileGrid({
    columns,
    options,
    selected,
    onPick,
}: {
    columns: 2 | 3;
    options: ReadonlyArray<TileOption>;
    selected: string;
    onPick: (v: string) => void;
}) {
    const colClass = columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2";
    return (
        <div className={`grid grid-cols-1 gap-3 ${colClass}`}>
            {options.map((o) => {
                const isActive = selected === o.value;
                return (
                    <button
                        key={o.value || "_none"}
                        type="button"
                        onClick={() => !o.disabled && onPick(o.value)}
                        disabled={o.disabled}
                        className="text-left transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                        style={{
                            padding: "1rem 1.1rem",
                            borderRadius: "var(--radius-card-sm)",
                            background: isActive
                                ? "var(--gradient-primary)"
                                : "var(--color-surface)",
                            color: isActive
                                ? "var(--color-text-on-primary)"
                                : "var(--color-text)",
                            boxShadow: isActive
                                ? "var(--shadow-clay-primary)"
                                : "var(--shadow-clay-inset)",
                            border: "1px solid transparent",
                        }}
                    >
                        <div className="text-base font-semibold">{o.label}</div>
                        {o.caption && (
                            <div
                                className="mt-1 text-xs"
                                style={{
                                    opacity: isActive ? 0.85 : 0.6,
                                }}
                            >
                                {o.caption}
                            </div>
                        )}
                    </button>
                );
            })}
        </div>
    );
}

function ChipGrid({
    options,
    selected,
    onPick,
}: {
    options: ReadonlyArray<{ value: string; label: string }>;
    selected: string;
    onPick: (v: string) => void;
}) {
    return (
        <div className="flex flex-wrap gap-2">
            {options.map((o) => {
                const isActive = selected === o.value;
                return (
                    <button
                        key={o.value}
                        type="button"
                        onClick={() => onPick(o.value)}
                        className="text-sm transition-transform active:scale-95"
                        style={{
                            padding: "0.55rem 1rem",
                            borderRadius: "999px",
                            background: isActive
                                ? "var(--gradient-primary)"
                                : "var(--color-surface)",
                            color: isActive
                                ? "var(--color-text-on-primary)"
                                : "var(--color-text)",
                            boxShadow: isActive
                                ? "var(--shadow-clay-primary)"
                                : "var(--shadow-clay-inset)",
                        }}
                    >
                        {o.label}
                    </button>
                );
            })}
        </div>
    );
}

function MultiChipGrid({
    options,
    selected,
    onToggle,
}: {
    options: ReadonlyArray<{ value: string; label: string }>;
    selected: ReadonlyArray<string>;
    onToggle: (v: string) => void;
}) {
    return (
        <div className="flex flex-wrap gap-2">
            {options.map((o) => {
                const isActive = selected.includes(o.value);
                return (
                    <button
                        key={o.value}
                        type="button"
                        onClick={() => onToggle(o.value)}
                        className="text-sm transition-transform active:scale-95"
                        style={{
                            padding: "0.55rem 1rem",
                            borderRadius: "999px",
                            background: isActive
                                ? "var(--gradient-primary)"
                                : "var(--color-surface)",
                            color: isActive
                                ? "var(--color-text-on-primary)"
                                : "var(--color-text)",
                            boxShadow: isActive
                                ? "var(--shadow-clay-primary)"
                                : "var(--shadow-clay-inset)",
                        }}
                    >
                        {isActive && <span className="mr-1">✓</span>}
                        {o.label}
                    </button>
                );
            })}
        </div>
    );
}

function SegmentedPills({
    options,
    selected,
    onPick,
}: {
    options: ReadonlyArray<{ value: string; label: string }>;
    selected: string;
    onPick: (v: string) => void;
}) {
    return (
        <div
            className="inline-flex w-full overflow-hidden p-1"
            style={{
                background: "var(--color-surface-alt)",
                borderRadius: "999px",
                boxShadow: "var(--shadow-clay-inset)",
            }}
        >
            {options.map((o) => {
                const isActive = selected === o.value;
                return (
                    <button
                        key={o.value || "_none"}
                        type="button"
                        onClick={() => onPick(o.value)}
                        className="flex-1 text-sm font-medium transition-all"
                        style={{
                            padding: "0.55rem 0.75rem",
                            borderRadius: "999px",
                            background: isActive
                                ? "var(--gradient-primary)"
                                : "transparent",
                            color: isActive
                                ? "var(--color-text-on-primary)"
                                : "var(--color-text-muted)",
                            boxShadow: isActive ? "var(--shadow-clay-primary)" : "none",
                        }}
                    >
                        {o.label}
                    </button>
                );
            })}
        </div>
    );
}

interface SliderFieldProps {
    readonly value: number | null;
    readonly min: number;
    readonly max: number;
    readonly step: number;
    readonly fallbackDefault: number;
    readonly formatValue: (v: number) => string;
    readonly suffix?: string;
    readonly onChange: (v: number) => void;
    readonly onClear: () => void;
}

function SliderField({
    value,
    min,
    max,
    step,
    fallbackDefault,
    formatValue,
    suffix,
    onChange,
    onClear,
}: SliderFieldProps) {
    const display = value ?? fallbackDefault;
    const pct = ((display - min) / (max - min)) * 100;
    const isSet = value !== null;
    return (
        <div className="space-y-5">
            <div className="flex items-baseline justify-between">
                <div
                    className="text-text text-4xl font-bold tabular-nums"
                    style={{ opacity: isSet ? 1 : 0.35 }}
                >
                    {formatValue(display)}
                    {suffix && (
                        <span className="text-text-muted ml-1 text-base font-medium">
                            {suffix}
                        </span>
                    )}
                </div>
                {isSet && (
                    <button
                        type="button"
                        onClick={onClear}
                        className="text-text-muted text-xs underline-offset-2 hover:underline"
                    >
                        清除
                    </button>
                )}
            </div>

            <div className="relative">
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={display}
                    onChange={(e) => onChange(Number(e.target.value))}
                    className="slider"
                    style={{
                        ["--slider-pct" as string]: `${pct}%`,
                    }}
                />
                <div className="text-text-muted mt-2 flex justify-between text-xs">
                    <span>{formatValue(min)}</span>
                    <span>{formatValue(max)}</span>
                </div>
            </div>

            <style>{`
                .slider {
                    -webkit-appearance: none;
                    appearance: none;
                    width: 100%;
                    height: 10px;
                    border-radius: 999px;
                    background: linear-gradient(
                        to right,
                        var(--color-primary-from) 0%,
                        var(--color-primary-to) var(--slider-pct, 50%),
                        var(--color-surface-alt) var(--slider-pct, 50%),
                        var(--color-surface-alt) 100%
                    );
                    box-shadow: var(--shadow-clay-inset);
                    outline: none;
                }
                .slider::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    appearance: none;
                    width: 26px;
                    height: 26px;
                    border-radius: 50%;
                    background: var(--gradient-primary);
                    box-shadow: var(--shadow-clay-primary);
                    cursor: pointer;
                    border: 2px solid var(--color-surface);
                }
                .slider::-moz-range-thumb {
                    width: 26px;
                    height: 26px;
                    border-radius: 50%;
                    background: var(--color-primary-from);
                    box-shadow: var(--shadow-clay-primary);
                    cursor: pointer;
                    border: 2px solid var(--color-surface);
                }
            `}</style>
        </div>
    );
}

function BudgetSlider({
    value,
    onChange,
    onClear,
}: {
    value: number | null;
    onChange: (v: number) => void;
    onClear: () => void;
}) {
    const MIN = 50000;
    const MAX = 500000;
    const STEP = 5000;
    const display = value ?? 200000;
    const pct = ((display - MIN) / (MAX - MIN)) * 100;
    const isSet = value !== null;
    const wan = (display / 10000).toFixed(1);
    const aud = Math.round(display / RMB_PER_AUD);
    return (
        <div className="space-y-5">
            <div className="flex items-baseline justify-between">
                <div style={{ opacity: isSet ? 1 : 0.35 }}>
                    <div className="text-text text-4xl font-bold tabular-nums">
                        ¥{wan}
                        <span className="text-text-muted ml-1 text-base font-medium">
                            万 / 年
                        </span>
                    </div>
                    <div className="text-text-muted mt-1 text-xs">
                        约合 A${aud.toLocaleString()} / 年
                    </div>
                </div>
                {isSet && (
                    <button
                        type="button"
                        onClick={onClear}
                        className="text-text-muted text-xs underline-offset-2 hover:underline"
                    >
                        清除
                    </button>
                )}
            </div>

            <div>
                <input
                    type="range"
                    min={MIN}
                    max={MAX}
                    step={STEP}
                    value={display}
                    onChange={(e) => onChange(Number(e.target.value))}
                    className="slider"
                    style={{ ["--slider-pct" as string]: `${pct}%` }}
                />
                <div className="text-text-muted mt-2 flex justify-between text-xs">
                    <span>¥5 万</span>
                    <span>¥50 万</span>
                </div>
            </div>
        </div>
    );
}
