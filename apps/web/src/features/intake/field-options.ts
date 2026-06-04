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
    { value: "Computer Science", label: "计算机科学 (Computer Science)" },
    { value: "Software Engineering", label: "软件工程" },
    { value: "Artificial Intelligence", label: "人工智能" },
    { value: "Human Computer Interaction", label: "人机交互" },
    { value: "Data Science", label: "数据科学" },
    { value: "Business", label: "商科 (Commerce/Business)" },
    { value: "Business Administration", label: "工商管理 (MBA)" },
    { value: "Business Analytics", label: "商业分析" },
    { value: "Finance", label: "金融" },
    { value: "Accounting", label: "会计" },
    { value: "Management", label: "管理" },
    { value: "Economics", label: "经济学" },
    { value: "Engineering", label: "工程" },
    { value: "Civil Engineering", label: "土木工程" },
    { value: "Electrical Engineering", label: "电气工程" },
    { value: "Mechanical Engineering", label: "机械工程" },
    { value: "Design", label: "设计" },
    { value: "Architecture", label: "建筑" },
    { value: "Public Health", label: "公共卫生" },
    { value: "Bioinformatics", label: "生物信息" },
    { value: "Public Policy", label: "公共政策" },
    { value: "Area Studies", label: "区域研究" },
    { value: "Education", label: "教育" },
    { value: "TESOL", label: "对外英语教学 (TESOL)" },
    { value: "Research", label: "研究型方向" },
    { value: "Statistics", label: "统计" },
    { value: "Environmental Science", label: "环境科学" },
    { value: "Forestry", label: "林业" },
];
