// Curated list of study fields exposed in the intake form.
//
// IMPORTANT: keep these `value` strings in lock-step with the `field`
// strings in packages/core/data/programs.*.json so that the rule engine
// can match exactly. We do NOT auto-derive at runtime to keep the dropdown
// stable across data refreshes and reviewable in a diff.

export interface FieldOption {
    readonly value: string;
    readonly label: string;
}

export const FIELD_OPTIONS: ReadonlyArray<FieldOption> = [
    { value: "", label: "未指定 / 还没想好" },
    { value: "Information Technology", label: "信息技术 (IT)" },
    { value: "Computing", label: "计算机科学" },
    { value: "Data Science", label: "数据科学" },
    { value: "Business", label: "商科 (Commerce/Business)" },
    { value: "Business Administration", label: "工商管理 (MBA)" },
    { value: "Finance", label: "金融" },
    { value: "Civil Engineering", label: "土木工程" },
    { value: "Electrical Engineering", label: "电气工程" },
    { value: "Mechanical Engineering", label: "机械工程" },
    { value: "Design", label: "设计" },
    { value: "TESOL", label: "对外英语教学 (TESOL)" },
];
