"use client";

import { useCallback, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { submitIntakeAction } from "../intake/intake-actions";
import { FIELD_OPTIONS } from "../intake/field-options";
import { ClarifyChat } from "../intake-clarify/clarify-chat";
import type {
    ClarifyPatch,
    FormFieldKey,
} from "../intake-clarify/clarify-schema";
import type { ExtractedProfile } from "@isp0526/core";

interface ReviewFormProps {
    readonly sessionId: string;
    readonly sourceLabel: string;
    readonly sourceText: string;
    readonly extracted: ExtractedProfile;
    readonly llmUsed: boolean;
}

const STUDY_LEVELS = [
    { value: "foundation", label: "预科 / Foundation" },
    { value: "pathway", label: "衔接 / Pathway" },
    { value: "diploma", label: "文凭 / Diploma" },
    { value: "bachelor", label: "本科（数据补齐中）" },
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

// Field-priority list for the clarify chat. Earlier = asked first.
const PRIORITY_FIELDS: ReadonlyArray<FormFieldKey> = [
    "target_field",
    "preferred_tags",
    "gpa",
    "ielts_overall",
    "teaching_style",
    "city_size",
    "target_level",
];

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

interface AISignal {
    readonly value: unknown;
    readonly confidence: number;
    readonly source_excerpt: string;
}

interface FormValues {
    target_level: string;
    target_field: string;
    gpa: string;
    ielts_overall: string;
    teaching_style: string;
    city_size: string;
    preferred_tags: string[];
}

// Per-field origin: tells the badge which color to show.
//   "ai"        -> extracted from raw input by the upload/voice LLM pass
//   "confirmed" -> patched by the clarify chat (counts as AI-verified)
//   "edited"    -> user manually touched the input
//   undefined   -> blank / untouched
type Origin = "ai" | "confirmed" | "edited";

export function ReviewForm({
    sessionId,
    sourceLabel,
    sourceText,
    extracted,
    llmUsed,
}: ReviewFormProps) {
    const signals = useMemo<Partial<Record<FormFieldKey, AISignal>>>(() => {
        const a = extracted.academic;
        const out: Partial<Record<FormFieldKey, AISignal>> = {};
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
        return out;
    }, [extracted]);

    const [values, setValues] = useState<FormValues>(() => ({
        target_level:
            (signals.target_level?.value as string | undefined) ?? "master",
        target_field: (signals.target_field?.value as string | undefined) ?? "",
        gpa: signals.gpa?.value !== undefined ? String(signals.gpa.value) : "",
        ielts_overall:
            signals.ielts_overall?.value !== undefined
                ? String(signals.ielts_overall.value)
                : "",
        teaching_style: "",
        city_size: "",
        preferred_tags: [],
    }));

    const [origins, setOrigins] = useState<Partial<Record<FormFieldKey, Origin>>>(
        () => {
            const out: Partial<Record<FormFieldKey, Origin>> = {};
            for (const k of Object.keys(signals) as FormFieldKey[]) {
                out[k] = "ai";
            }
            return out;
        },
    );

    const setField = useCallback(
        <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
            setValues((prev) => ({ ...prev, [key]: value }));
        },
        [],
    );

    const markEdited = useCallback((k: FormFieldKey) => {
        setOrigins((prev) => ({ ...prev, [k]: "edited" }));
    }, []);

    const toggleTag = (tag: string) => {
        setValues((prev) => ({
            ...prev,
            preferred_tags: prev.preferred_tags.includes(tag)
                ? prev.preferred_tags.filter((t) => t !== tag)
                : [...prev.preferred_tags, tag],
        }));
        markEdited("preferred_tags");
    };

    const applyPatch = useCallback((patch: ClarifyPatch) => {
        setValues((prev) => {
            const next = { ...prev };
            if (patch.target_level) next.target_level = patch.target_level;
            if (patch.target_field) next.target_field = patch.target_field;
            if (patch.gpa !== undefined) next.gpa = String(patch.gpa);
            if (patch.ielts_overall !== undefined)
                next.ielts_overall = String(patch.ielts_overall);
            if (patch.teaching_style)
                next.teaching_style = patch.teaching_style;
            if (patch.city_size) next.city_size = patch.city_size;
            if (patch.preferred_tags && patch.preferred_tags.length > 0)
                next.preferred_tags = [...patch.preferred_tags];
            return next;
        });
        setOrigins((prev) => {
            const next = { ...prev };
            for (const k of Object.keys(patch) as FormFieldKey[]) {
                next[k] = "confirmed";
            }
            return next;
        });
    }, []);

    // Snapshot the chat sends back so the prompt knows what's already filled.
    const currentValues = useMemo<Record<string, unknown>>(() => {
        const out: Record<string, unknown> = {};
        if (values.target_level) out.target_level = values.target_level;
        if (values.target_field) out.target_field = values.target_field;
        if (values.gpa) out.gpa = Number(values.gpa);
        if (values.ielts_overall) out.ielts_overall = Number(values.ielts_overall);
        if (values.teaching_style) out.teaching_style = values.teaching_style;
        if (values.city_size) out.city_size = values.city_size;
        if (values.preferred_tags.length > 0)
            out.preferred_tags = values.preferred_tags;
        return out;
    }, [values]);

    const missingKeys = useMemo<FormFieldKey[]>(
        () =>
            PRIORITY_FIELDS.filter((k) => {
                if (k === "preferred_tags")
                    return values.preferred_tags.length === 0;
                if (k === "target_level") return false; // has a sensible default
                return !values[k];
            }),
        [values],
    );

    return (
        <div className="space-y-6">
            {llmUsed ? (
                <ClarifyChat
                    sessionId={sessionId}
                    currentValues={currentValues}
                    missingKeys={missingKeys}
                    onPatch={applyPatch}
                />
            ) : null}

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
                        origin={origins.target_level}
                    >
                        <select
                            name="target_level"
                            value={values.target_level}
                            required
                            onChange={(e) => {
                                setField("target_level", e.target.value);
                                markEdited("target_level");
                            }}
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
                        origin={origins.target_field}
                    >
                        <select
                            name="target_field"
                            value={values.target_field}
                            onChange={(e) => {
                                setField("target_field", e.target.value);
                                markEdited("target_field");
                            }}
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
                            origin={origins.gpa}
                        >
                            <input
                                type="number"
                                name="gpa"
                                step="0.01"
                                min="0"
                                max="4"
                                placeholder="3.4"
                                value={values.gpa}
                                onChange={(e) => {
                                    setField("gpa", e.target.value);
                                    markEdited("gpa");
                                }}
                                className="form-control"
                            />
                        </BadgedField>
                        <BadgedField
                            label="IELTS 总分（可选）"
                            signal={signals.ielts_overall}
                            origin={origins.ielts_overall}
                        >
                            <input
                                type="number"
                                name="ielts_overall"
                                step="0.5"
                                min="0"
                                max="9"
                                placeholder="7.0"
                                value={values.ielts_overall}
                                onChange={(e) => {
                                    setField("ielts_overall", e.target.value);
                                    markEdited("ielts_overall");
                                }}
                                className="form-control"
                            />
                        </BadgedField>
                    </div>

                    <BadgedField
                        label="学习风格偏好"
                        origin={origins.teaching_style}
                    >
                        <select
                            name="teaching_style"
                            value={values.teaching_style}
                            onChange={(e) => {
                                setField("teaching_style", e.target.value);
                                markEdited("teaching_style");
                            }}
                            className="form-control"
                        >
                            {TEACHING_STYLES.map((o) => (
                                <option key={o.value} value={o.value}>
                                    {o.label}
                                </option>
                            ))}
                        </select>
                    </BadgedField>

                    <BadgedField label="城市规模偏好" origin={origins.city_size}>
                        <select
                            name="city_size"
                            value={values.city_size}
                            onChange={(e) => {
                                setField("city_size", e.target.value);
                                markEdited("city_size");
                            }}
                            className="form-control"
                        >
                            {CITY_SIZES.map((o) => (
                                <option key={o.value} value={o.value}>
                                    {o.label}
                                </option>
                            ))}
                        </select>
                    </BadgedField>

                    <fieldset className="space-y-3">
                        <legend className="text-text flex items-center gap-2 text-sm font-medium">
                            你看重哪些方面？（可多选）
                            {origins.preferred_tags ? (
                                <OriginBadge origin={origins.preferred_tags} />
                            ) : null}
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
                                        checked={values.preferred_tags.includes(
                                            tag.value,
                                        )}
                                        onChange={() => toggleTag(tag.value)}
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
                    资料来源
                </p>
                <h2 className="text-text text-lg font-semibold">{label}</h2>
                <p className="text-text-muted text-xs">
                    {!llmUsed
                        ? "系统未能自动提取信息，请手动填写右侧字段。"
                        : fieldsExtracted === 0
                            ? "系统未从原文中提取到字段。请补充右侧信息。"
                            : `已从原文提取 ${fieldsExtracted} 个字段，请核对后继续。`}
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
                        补充说明
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
    origin,
    children,
}: {
    label: string;
    required?: boolean;
    signal?: AISignal;
    origin?: Origin;
    children: React.ReactNode;
}) {
    const showExcerpt = signal && origin !== "edited" && origin !== "confirmed";
    return (
        <label className="block space-y-2">
            <span className="flex items-center justify-between gap-3">
                <span className="text-text text-sm font-medium">
                    {label}
                    {required ? <span className="text-warning"> *</span> : null}
                </span>
                <ConfidenceBadge signal={signal} origin={origin} />
            </span>
            {children}
            {showExcerpt ? (
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

function OriginBadge({ origin }: { origin: Origin }) {
    if (origin === "confirmed") {
        return (
            <span
                className="rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider text-white"
                style={{ background: "var(--color-success, #2f9461)" }}
            >
                已确认
            </span>
        );
    }
    if (origin === "edited") {
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
    return null;
}

function ConfidenceBadge({
    signal,
    origin,
}: {
    signal?: AISignal;
    origin?: Origin;
}) {
    if (origin === "confirmed") {
        return (
            <span
                className="rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider text-white"
                style={{ background: "var(--color-success, #2f9461)" }}
            >
                已确认
            </span>
        );
    }
    if (origin === "edited") {
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
            title={`提取置信度：${(signal.confidence * 100).toFixed(0)}%`}
        >
            {high ? "置信较高" : "请核对"}
        </span>
    );
}

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <button
            type="submit"
            disabled={pending}
            className="w-full rounded-button px-6 py-3 text-sm font-semibold text-white disabled:opacity-50"
            style={{
                background: "var(--gradient-primary)",
                boxShadow: "var(--shadow-clay-primary)",
            }}
        >
            {pending ? "正在生成报告..." : "确认无误，生成推荐"}
        </button>
    );
}

function truncate(s: string, n: number): string {
    return s.length > n ? s.slice(0, n) + "…" : s;
}
