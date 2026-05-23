"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { submitIntakeAction } from "../intake/intake-actions";
import { FIELD_OPTIONS } from "../intake/field-options";
import type { ExtractedProfile } from "@isp0526/core";

interface ReviewFormProps {
    readonly sourceLabel: string;
    readonly sourceText: string;
    readonly extracted: ExtractedProfile;
    readonly llmUsed: boolean;
}

const STUDY_LEVELS = [
    { value: "bachelor", label: "本科（暂无项目数据）" },
    { value: "master", label: "硕士" },
    { value: "phd", label: "博士（暂无项目数据）" },
] as const;

const TEACHING_STYLES = [
    { value: "", label: "未指定" },
    { value: "theory_heavy", label: "偏理论" },
    { value: "balanced", label: "理论与应用平衡" },
    { value: "applied_heavy", label: "偏实践" },
] as const;

const CITY_SIZES = [
    { value: "", label: "未指定" },
    { value: "mega", label: "超大城市（悉尼/墨尔本）" },
    { value: "large", label: "大城市" },
    { value: "medium", label: "中等城市" },
    { value: "small", label: "小城市" },
] as const;

const TAGS = [
    { value: "field_top", label: "学科顶尖" },
    { value: "migration_friendly", label: "利于移民" },
    { value: "career_pipeline", label: "就业渠道" },
    { value: "value_for_money", label: "性价比" },
    { value: "scholarship_rich", label: "奖学金多" },
    { value: "chinese_community", label: "华人社区活跃" },
] as const;

// Map an AI-emitted free-text discipline onto our curated dropdown values.
// Case-insensitive substring match against both value and label so e.g.
// "Computer Science" -> "Computing", "Data" -> "Data Science", "金融" ->
// "Finance". Returns "" when nothing matches; user can pick manually.
function matchField(aiValue: string): string {
    const q = aiValue.toLowerCase().trim();
    if (!q) return "";
    for (const opt of FIELD_OPTIONS) {
        if (!opt.value) continue;
        if (
            opt.value.toLowerCase().includes(q) ||
            q.includes(opt.value.toLowerCase()) ||
            opt.label.toLowerCase().includes(q)
        ) {
            return opt.value;
        }
    }
    return "";
}

type FieldKey =
    | "target_level"
    | "target_field"
    | "gpa"
    | "ielts_overall"
    | "annual_budget_aud";

interface AISignal {
    readonly value: unknown;
    readonly confidence: number;
    readonly source_excerpt: string;
}

export function ReviewForm({
    sourceLabel,
    sourceText,
    extracted,
    llmUsed,
}: ReviewFormProps) {
    const signals = useMemo<Partial<Record<FieldKey, AISignal>>>(() => {
        const a = extracted.academic;
        const b = extracted.budget;
        const out: Partial<Record<FieldKey, AISignal>> = {};
        if (a.target_level) out.target_level = a.target_level;
        if (a.target_field) {
            const matched = matchField(a.target_field.value);
            if (matched) {
                out.target_field = {
                    value: matched,
                    confidence: a.target_field.confidence,
                    source_excerpt: a.target_field.source_excerpt,
                };
            }
        }
        if (a.gpa) out.gpa = a.gpa;
        if (a.ielts_overall) out.ielts_overall = a.ielts_overall;
        if (b.annual_aud) out.annual_budget_aud = b.annual_aud;
        return out;
    }, [extracted]);

    // Track which fields the user has edited so we can switch the badge.
    const [edited, setEdited] = useState<Set<FieldKey>>(new Set());
    const markEdited = (k: FieldKey) =>
        setEdited((prev) => {
            if (prev.has(k)) return prev;
            const next = new Set(prev);
            next.add(k);
            return next;
        });

    return (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <SourcePanel
                label={sourceLabel}
                text={sourceText}
                llmUsed={llmUsed}
                fieldsExtracted={Object.keys(signals).length}
                notes={extracted.unstructured_notes}
            />

            <form action={submitIntakeAction} className="space-y-6">
                <BadgedField
                    label="目标学位"
                    required
                    signal={signals.target_level}
                    edited={edited.has("target_level")}
                >
                    <select
                        name="target_level"
                        defaultValue={
                            (signals.target_level?.value as string | undefined) ??
                            "master"
                        }
                        required
                        onChange={() => markEdited("target_level")}
                        className="form-control"
                    >
                        {STUDY_LEVELS.map((o) => (
                            <option key={o.value} value={o.value}>
                                {o.label}
                            </option>
                        ))}
                    </select>
                </BadgedField>

                <BadgedField
                    label="目标方向（可选）"
                    signal={signals.target_field}
                    edited={edited.has("target_field")}
                >
                    <select
                        name="target_field"
                        defaultValue={
                            (signals.target_field?.value as string | undefined) ??
                            ""
                        }
                        onChange={() => markEdited("target_field")}
                        className="form-control"
                    >
                        {FIELD_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                                {o.label}
                            </option>
                        ))}
                    </select>
                </BadgedField>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <BadgedField
                        label="GPA（4 分制，可选）"
                        signal={signals.gpa}
                        edited={edited.has("gpa")}
                    >
                        <input
                            type="number"
                            name="gpa"
                            step="0.01"
                            min="0"
                            max="4"
                            placeholder="3.4"
                            defaultValue={
                                (signals.gpa?.value as number | undefined) ?? ""
                            }
                            onChange={() => markEdited("gpa")}
                            className="form-control"
                        />
                    </BadgedField>
                    <BadgedField
                        label="IELTS 总分（可选）"
                        signal={signals.ielts_overall}
                        edited={edited.has("ielts_overall")}
                    >
                        <input
                            type="number"
                            name="ielts_overall"
                            step="0.5"
                            min="0"
                            max="9"
                            placeholder="7.0"
                            defaultValue={
                                (signals.ielts_overall?.value as number | undefined) ??
                                ""
                            }
                            onChange={() => markEdited("ielts_overall")}
                            className="form-control"
                        />
                    </BadgedField>
                </div>

                <BadgedField label="学习风格偏好">
                    <select
                        name="teaching_style"
                        defaultValue=""
                        className="form-control"
                    >
                        {TEACHING_STYLES.map((o) => (
                            <option key={o.value} value={o.value}>
                                {o.label}
                            </option>
                        ))}
                    </select>
                </BadgedField>

                <BadgedField label="城市规模偏好">
                    <select name="city_size" defaultValue="" className="form-control">
                        {CITY_SIZES.map((o) => (
                            <option key={o.value} value={o.value}>
                                {o.label}
                            </option>
                        ))}
                    </select>
                </BadgedField>

                <BadgedField
                    label="年度全包预算 AUD（学费 + 生活，可选）"
                    signal={signals.annual_budget_aud}
                    edited={edited.has("annual_budget_aud")}
                >
                    <input
                        type="number"
                        name="annual_budget_aud"
                        step="1000"
                        min="0"
                        placeholder="70000"
                        defaultValue={
                            (signals.annual_budget_aud?.value as
                                | number
                                | undefined) ?? ""
                        }
                        onChange={() => markEdited("annual_budget_aud")}
                        className="form-control"
                    />
                </BadgedField>

                <fieldset className="space-y-3">
                    <legend className="text-text text-sm font-medium">
                        你看重哪些方面？（可多选）
                    </legend>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {TAGS.map((tag) => (
                            <label
                                key={tag.value}
                                className="text-text flex items-center gap-2 text-sm"
                            >
                                <input
                                    type="checkbox"
                                    name="preferred_tags"
                                    value={tag.value}
                                    className="h-4 w-4"
                                />
                                {tag.label}
                            </label>
                        ))}
                    </div>
                </fieldset>

                <SubmitButton />

                <style>{`
                    .form-control {
                        width: 100%;
                        padding: 0.625rem 0.875rem;
                        border-radius: var(--radius-button);
                        background: var(--color-surface);
                        color: var(--color-text);
                        border: 1px solid transparent;
                        box-shadow: var(--shadow-clay-inset);
                        font: inherit;
                    }
                    .form-control:focus {
                        outline: none;
                        border-color: var(--color-primary-from);
                    }
                `}</style>
            </form>
        </div>
    );
}

function SourcePanel({
    label,
    text,
    llmUsed,
    fieldsExtracted,
    notes,
}: {
    label: string;
    text: string;
    llmUsed: boolean;
    fieldsExtracted: number;
    notes?: string;
}) {
    const [expanded, setExpanded] = useState(false);
    const preview = text.length > 600 ? text.slice(0, 600) + "…" : text;
    return (
        <aside
            className="space-y-4 p-5"
            style={{
                background: "var(--color-surface)",
                borderRadius: "var(--radius-card-md)",
                boxShadow: "var(--shadow-clay-card)",
            }}
        >
            <div className="space-y-1">
                <p className="text-text-muted text-xs uppercase tracking-widest">
                    战利品来源
                </p>
                <h2 className="text-text text-lg font-semibold">{label}</h2>
                <p className="text-text-muted text-xs">
                    {llmUsed
                        ? `AI 从这里抠出了 ${fieldsExtracted} 个字段`
                        : "AI 没启动（未配置或失败），右侧字段需要手动填写"}
                </p>
            </div>

            <div
                className="space-y-2 p-3 text-xs leading-relaxed"
                style={{
                    background: "var(--color-surface-alt)",
                    borderRadius: "var(--radius-card-sm)",
                    maxHeight: expanded ? "none" : "260px",
                    overflow: "auto",
                    whiteSpace: "pre-wrap",
                }}
            >
                {expanded ? text : preview}
            </div>
            {text.length > 600 ? (
                <button
                    type="button"
                    onClick={() => setExpanded((v) => !v)}
                    className="text-text-muted hover:text-text text-xs underline"
                >
                    {expanded ? "收起" : "展开全文"}
                </button>
            ) : null}

            {notes ? (
                <div className="space-y-1">
                    <p className="text-text-muted text-xs uppercase tracking-widest">
                        AI 的额外笔记
                    </p>
                    <p className="text-text text-xs leading-relaxed">{notes}</p>
                </div>
            ) : null}
        </aside>
    );
}

function BadgedField({
    label,
    required,
    signal,
    edited,
    children,
}: {
    label: string;
    required?: boolean;
    signal?: AISignal;
    edited?: boolean;
    children: React.ReactNode;
}) {
    return (
        <label className="block space-y-2">
            <span className="flex items-center justify-between gap-3">
                <span className="text-text text-sm font-medium">
                    {label}
                    {required ? <span className="text-warning"> *</span> : null}
                </span>
                <ConfidenceBadge signal={signal} edited={edited} />
            </span>
            {children}
            {signal && !edited ? (
                <span
                    className="text-text-muted block text-[11px] italic"
                    title={signal.source_excerpt}
                >
                    出处：「{truncate(signal.source_excerpt, 80)}」
                </span>
            ) : null}
        </label>
    );
}

function ConfidenceBadge({
    signal,
    edited,
}: {
    signal?: AISignal;
    edited?: boolean;
}) {
    if (edited) {
        return (
            <span
                className="rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider"
                style={{
                    background: "var(--color-surface-alt)",
                    color: "var(--color-text-muted)",
                }}
            >
                已修改
            </span>
        );
    }
    if (!signal) return null;
    const high = signal.confidence >= 0.7;
    return (
        <span
            className="rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider text-white"
            style={{
                background: high
                    ? "var(--color-success, #2f9461)"
                    : "var(--color-warning, #c0883a)",
            }}
            title={`AI confidence: ${(signal.confidence * 100).toFixed(0)}%`}
        >
            {high ? "AI 高置信" : "AI 推测 · 请核对"}
        </span>
    );
}

function truncate(s: string, n: number): string {
    return s.length > n ? s.slice(0, n) + "…" : s;
}

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <button
            type="submit"
            disabled={pending}
            className="text-text-on-primary w-full px-6 py-3 text-base font-semibold transition-transform active:scale-95 disabled:opacity-60"
            style={{
                background: "var(--gradient-primary)",
                borderRadius: "var(--radius-button)",
                boxShadow: "var(--shadow-clay-primary)",
            }}
        >
            {pending ? "正在生成报告…" : "看上去都对，开 BOSS 战"}
        </button>
    );
}
