"use client";

import { useFormStatus } from "react-dom";
import { FIELD_OPTIONS } from "./field-options";

interface IntakeFormProps {
    readonly action: (formData: FormData) => Promise<void>;
}

const STUDY_LEVELS = [
    { value: "bachelor", label: "本科" },
    { value: "master", label: "硕士" },
    { value: "phd", label: "博士" },
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

export function IntakeForm({ action }: IntakeFormProps) {
    return (
        <form action={action} className="space-y-6">
            <Field label="目标学位" required>
                <select
                    name="target_level"
                    defaultValue="master"
                    required
                    className="form-control"
                >
                    {STUDY_LEVELS.map((o) => (
                        <option key={o.value} value={o.value}>
                            {o.label}
                        </option>
                    ))}
                </select>
            </Field>

            <Field label="目标方向（可选）">
                <select
                    name="target_field"
                    defaultValue=""
                    className="form-control"
                >
                    {FIELD_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                            {o.label}
                        </option>
                    ))}
                </select>
            </Field>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <Field label="GPA（4 分制，可选）">
                    <input
                        type="number"
                        name="gpa"
                        step="0.01"
                        min="0"
                        max="4"
                        placeholder="3.4"
                        className="form-control"
                    />
                </Field>
                <Field label="IELTS 总分（可选）">
                    <input
                        type="number"
                        name="ielts_overall"
                        step="0.5"
                        min="0"
                        max="9"
                        placeholder="7.0"
                        className="form-control"
                    />
                </Field>
            </div>

            <Field label="学习风格偏好">
                <select name="teaching_style" defaultValue="" className="form-control">
                    {TEACHING_STYLES.map((o) => (
                        <option key={o.value} value={o.value}>
                            {o.label}
                        </option>
                    ))}
                </select>
            </Field>

            <Field label="城市规模偏好">
                <select name="city_size" defaultValue="" className="form-control">
                    {CITY_SIZES.map((o) => (
                        <option key={o.value} value={o.value}>
                            {o.label}
                        </option>
                    ))}
                </select>
            </Field>

            <Field label="年度全包预算 AUD（学费 + 生活，可选）">
                <input
                    type="number"
                    name="annual_budget_aud"
                    step="1000"
                    min="0"
                    placeholder="70000"
                    className="form-control"
                />
            </Field>

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
    );
}

function Field({
    label,
    required,
    children,
}: {
    label: string;
    required?: boolean;
    children: React.ReactNode;
}) {
    return (
        <label className="block space-y-2">
            <span className="text-text text-sm font-medium">
                {label}
                {required && <span className="text-warning"> *</span>}
            </span>
            {children}
        </label>
    );
}

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <button
            type="submit"
            disabled={pending}
            className="text-text-on-primary px-6 py-3 text-base font-semibold transition-transform active:scale-95 disabled:opacity-60"
            style={{
                background: "var(--gradient-primary)",
                borderRadius: "var(--radius-button)",
                boxShadow: "var(--shadow-clay-primary)",
            }}
        >
            {pending ? "正在生成报告…" : "生成我的推荐"}
        </button>
    );
}
