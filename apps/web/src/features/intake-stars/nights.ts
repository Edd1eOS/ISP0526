// Authored constellation definitions. Star positions are hand-placed for
// composition; if you re-balance a cluster, render the page locally and
// eyeball it - there is no automatic layout.
//
// Every star whose pick should influence the downstream ClarifyPatch
// carries a `meta` block; bare flavour stars omit it.
//
// At runtime, `resolveNights()` walks the candidate pool and only
// returns the nights whose target field is still missing in the
// accumulated patch / assessment. The decorative astrolabe is rendered
// by StarChartStage during the picking phase, not as a night.

import type {
    BudgetNight,
    FieldGroup,
    NightDef,
    PickerNight,
    ResolverContext,
} from "./types";

// ---------------------------------------------------------------------------
// Candidate nights (authored). resolveNights() picks the missing ones.
// ---------------------------------------------------------------------------

/** Level: required gate. Always shown if accumulated.target_level is empty. */
export const NIGHT_LEVEL: PickerNight = {
    kind: "picker",
    id: "level",
    title: "学习阶段",
    subtitle: "先点亮一颗:你这次想读到哪一层",
    minPicks: 1,
    maxPicks: 1,
    stars: [
        {
            id: "level_foundation",
            label: "预科",
            x: 18,
            y: 34,
            mag: 3,
            meta: { target_level: "foundation" },
        },
        {
            id: "level_pathway",
            label: "衔接",
            x: 34,
            y: 28,
            mag: 3,
            meta: { target_level: "pathway" },
        },
        {
            id: "level_diploma",
            label: "文凭",
            x: 50,
            y: 42,
            mag: 3,
            meta: { target_level: "diploma" },
        },
        {
            id: "level_bachelor",
            label: "本科",
            x: 62,
            y: 24,
            mag: 3,
            meta: { target_level: "bachelor" },
        },
        {
            id: "level_master",
            label: "硕士",
            x: 76,
            y: 36,
            mag: 3,
            meta: { target_level: "master" },
        },
        {
            id: "level_phd",
            label: "博士 / 研究型",
            x: 86,
            y: 56,
            mag: 2,
            meta: { target_level: "phd" },
        },
    ],
};

/** Field group. This does not write target_field; it routes to a detail night. */
export const NIGHT_FIELD_GROUP: PickerNight = {
    kind: "picker",
    id: "field_group",
    title: "选择领域",
    subtitle: "先选一个最接近的方向，下一步会细分专业",
    minPicks: 1,
    maxPicks: 1,
    stars: [
        {
            id: "group_business",
            label: "商科 / 管理",
            x: 22,
            y: 28,
            mag: 3,
            meta: { field_group: "business" },
        },
        {
            id: "group_computing",
            label: "计算机 / 数据",
            x: 50,
            y: 20,
            mag: 3,
            meta: { field_group: "computing" },
        },
        {
            id: "group_engineering",
            label: "工程",
            x: 76,
            y: 30,
            mag: 2,
            meta: { field_group: "engineering" },
        },
        {
            id: "group_design",
            label: "设计 / 建筑",
            x: 18,
            y: 54,
            mag: 2,
            meta: { field_group: "design" },
        },
        {
            id: "group_health",
            label: "健康 / 生命科学",
            x: 40,
            y: 62,
            mag: 2,
            meta: { field_group: "health" },
        },
        {
            id: "group_social",
            label: "社科 / 公共方向",
            x: 64,
            y: 58,
            mag: 2,
            meta: { field_group: "social" },
        },
        {
            id: "group_education",
            label: "教育 / 语言",
            x: 82,
            y: 52,
            mag: 1,
            meta: { field_group: "education" },
        },
        {
            id: "group_science",
            label: "科研 / 基础方向",
            x: 50,
            y: 82,
            mag: 1,
            meta: { field_group: "science" },
        },
    ],
};

export const FIELD_DETAIL_NIGHTS: Readonly<Record<FieldGroup, PickerNight>> = {
    business: {
        kind: "picker",
        id: "field_detail_business",
        title: "细分商科方向",
        subtitle: "选择最接近你申请目标的专业",
        minPicks: 1,
        maxPicks: 1,
        stars: [
            { id: "field_business", label: "商科", x: 18, y: 30, mag: 2, meta: { target_field: "Business" } },
            { id: "field_finance", label: "金融", x: 42, y: 22, mag: 3, meta: { target_field: "Finance" } },
            { id: "field_accounting", label: "会计", x: 68, y: 30, mag: 2, meta: { target_field: "Accounting" } },
            { id: "field_business_analytics", label: "商业分析", x: 28, y: 58, mag: 3, meta: { target_field: "Business Analytics" } },
            { id: "field_management", label: "管理", x: 54, y: 64, mag: 2, meta: { target_field: "Management" } },
            { id: "field_economics", label: "经济学", x: 78, y: 58, mag: 2, meta: { target_field: "Economics" } },
            { id: "field_mba", label: "工商管理 / MBA", x: 50, y: 82, mag: 1, meta: { target_field: "Business Administration" } },
        ],
    },
    computing: {
        kind: "picker",
        id: "field_detail_computing",
        title: "细分计算机方向",
        subtitle: "选择最接近你申请目标的专业",
        minPicks: 1,
        maxPicks: 1,
        stars: [
            { id: "field_it", label: "信息技术", x: 18, y: 32, mag: 2, meta: { target_field: "Information Technology" } },
            { id: "field_computing", label: "计算机", x: 42, y: 22, mag: 3, meta: { target_field: "Computing" } },
            { id: "field_computer_science", label: "计算机科学", x: 68, y: 32, mag: 3, meta: { target_field: "Computer Science" } },
            { id: "field_software", label: "软件工程", x: 26, y: 60, mag: 2, meta: { target_field: "Software Engineering" } },
            { id: "field_ai", label: "人工智能", x: 50, y: 72, mag: 2, meta: { target_field: "Artificial Intelligence" } },
            { id: "field_data_science", label: "数据科学", x: 74, y: 58, mag: 2, meta: { target_field: "Data Science" } },
            { id: "field_hci", label: "人机交互", x: 50, y: 44, mag: 1, meta: { target_field: "Human Computer Interaction" } },
        ],
    },
    engineering: {
        kind: "picker",
        id: "field_detail_engineering",
        title: "细分工程方向",
        subtitle: "选择最接近你申请目标的专业",
        minPicks: 1,
        maxPicks: 1,
        stars: [
            { id: "field_engineering", label: "工程", x: 24, y: 34, mag: 3, meta: { target_field: "Engineering" } },
            { id: "field_civil", label: "土木工程", x: 48, y: 24, mag: 2, meta: { target_field: "Civil Engineering" } },
            { id: "field_electrical", label: "电气工程", x: 72, y: 38, mag: 2, meta: { target_field: "Electrical Engineering" } },
            { id: "field_mechanical", label: "机械工程", x: 38, y: 64, mag: 2, meta: { target_field: "Mechanical Engineering" } },
        ],
    },
    design: {
        kind: "picker",
        id: "field_detail_design",
        title: "细分设计方向",
        subtitle: "选择最接近你申请目标的专业",
        minPicks: 1,
        maxPicks: 1,
        stars: [
            { id: "field_design", label: "设计", x: 28, y: 34, mag: 3, meta: { target_field: "Design" } },
            { id: "field_architecture", label: "建筑", x: 52, y: 24, mag: 2, meta: { target_field: "Architecture" } },
            { id: "field_design_hci", label: "人机交互", x: 70, y: 54, mag: 2, meta: { target_field: "Human Computer Interaction" } },
        ],
    },
    health: {
        kind: "picker",
        id: "field_detail_health",
        title: "细分健康方向",
        subtitle: "选择最接近你申请目标的专业",
        minPicks: 1,
        maxPicks: 1,
        stars: [
            { id: "field_public_health", label: "公共卫生", x: 34, y: 34, mag: 3, meta: { target_field: "Public Health" } },
            { id: "field_bioinformatics", label: "生物信息", x: 58, y: 24, mag: 2, meta: { target_field: "Bioinformatics" } },
        ],
    },
    social: {
        kind: "picker",
        id: "field_detail_social",
        title: "细分社科方向",
        subtitle: "选择最接近你申请目标的专业",
        minPicks: 1,
        maxPicks: 1,
        stars: [
            { id: "field_public_policy", label: "公共政策", x: 24, y: 34, mag: 3, meta: { target_field: "Public Policy" } },
            { id: "field_area_studies", label: "区域研究", x: 50, y: 24, mag: 2, meta: { target_field: "Area Studies" } },
            { id: "field_social_economics", label: "经济学", x: 72, y: 52, mag: 2, meta: { target_field: "Economics" } },
        ],
    },
    education: {
        kind: "picker",
        id: "field_detail_education",
        title: "细分教育方向",
        subtitle: "选择最接近你申请目标的专业",
        minPicks: 1,
        maxPicks: 1,
        stars: [
            { id: "field_education", label: "教育", x: 34, y: 34, mag: 3, meta: { target_field: "Education" } },
            { id: "field_tesol", label: "TESOL", x: 58, y: 24, mag: 2, meta: { target_field: "TESOL" } },
        ],
    },
    science: {
        kind: "picker",
        id: "field_detail_science",
        title: "细分科研方向",
        subtitle: "选择最接近你申请目标的专业",
        minPicks: 1,
        maxPicks: 1,
        stars: [
            { id: "field_research", label: "研究型方向", x: 20, y: 34, mag: 3, meta: { target_field: "Research" } },
            { id: "field_statistics", label: "统计", x: 42, y: 24, mag: 2, meta: { target_field: "Statistics" } },
            { id: "field_environmental", label: "环境科学", x: 66, y: 34, mag: 2, meta: { target_field: "Environmental Science" } },
            { id: "field_forestry", label: "林业", x: 52, y: 64, mag: 1, meta: { target_field: "Forestry" } },
        ],
    },
};

/** Legacy alias for old projection helpers. Runtime uses NIGHT_FIELD_GROUP. */
export const NIGHT_FIELD = NIGHT_FIELD_GROUP;

/** Annual budget, AUD. Linear light-strip with five anchor points. */
export const NIGHT_BUDGET: BudgetNight = {
    kind: "budget",
    id: "budget",
    title: "预算",
    subtitle: "把那颗星拉到你能接受的位置(澳元 / 年)",
    anchors: [
        { value: 25000, label: "≤ 2.5 万", x: 8 },
        { value: 35000, label: "3.5 万", x: 30 },
        { value: 50000, label: "5 万", x: 52 },
        { value: 70000, label: "7 万", x: 74 },
        { value: 90000, label: "≥ 9 万", x: 94 },
    ],
};

/** Value tags. Multi-select; pure preferred_tags. */
export const NIGHT_TAGS: PickerNight = {
    kind: "picker",
    id: "tags",
    title: "你最看重哪几件事",
    subtitle: "选 1 到 3 颗:决定了我们筛学校的优先级",
    minPicks: 1,
    maxPicks: 3,
    stars: [
        {
            id: "tag_field_top",
            label: "学科声誉 / 排名",
            x: 22,
            y: 30,
            mag: 3,
            meta: { preferred_tags: ["field_top"] },
        },
        {
            id: "tag_career",
            label: "就业管道 / 实习",
            x: 50,
            y: 22,
            mag: 3,
            meta: { preferred_tags: ["career_pipeline"] },
        },
        {
            id: "tag_scholarship",
            label: "奖学金机会多",
            x: 76,
            y: 32,
            mag: 2,
            meta: { preferred_tags: ["scholarship_rich"] },
        },
        {
            id: "tag_value",
            label: "性价比",
            x: 30,
            y: 58,
            mag: 2,
            meta: { preferred_tags: ["value_for_money"] },
        },
        {
            id: "tag_chinese",
            label: "靠近华人社区",
            x: 60,
            y: 60,
            mag: 2,
            meta: { preferred_tags: ["chinese_community"] },
        },
        {
            id: "tag_migration",
            label: "毕业利于留澳 / 移民",
            x: 46,
            y: 80,
            mag: 2,
            meta: { preferred_tags: ["migration_friendly"] },
        },
    ],
};

/** Fallback only: assessment normally fills city_size already. */
export const NIGHT_CITY_FALLBACK: PickerNight = {
    kind: "picker",
    id: "city_size",
    title: "城市规模",
    subtitle: "选 1 颗:你想落在什么尺寸的城市",
    minPicks: 1,
    maxPicks: 1,
    stars: [
        {
            id: "city_mega",
            label: "超大城市",
            x: 22,
            y: 36,
            mag: 3,
            meta: { city_size: "mega" },
        },
        {
            id: "city_large",
            label: "大城市",
            x: 44,
            y: 28,
            mag: 2,
            meta: { city_size: "large" },
        },
        {
            id: "city_medium",
            label: "中型城市",
            x: 66,
            y: 36,
            mag: 2,
            meta: { city_size: "medium" },
        },
        {
            id: "city_small",
            label: "小城 / 大学城",
            x: 84,
            y: 50,
            mag: 1,
            meta: { city_size: "small" },
        },
    ],
};

/** Fallback only: assessment normally fills teaching_style already. */
export const NIGHT_TEACHING_FALLBACK: PickerNight = {
    kind: "picker",
    id: "teaching",
    title: "教学风格",
    subtitle: "选 1 颗:你想要的课堂",
    minPicks: 1,
    maxPicks: 1,
    stars: [
        {
            id: "teach_theory",
            label: "偏理论",
            x: 28,
            y: 38,
            mag: 2,
            meta: { teaching_style: "theory_heavy" },
        },
        {
            id: "teach_balanced",
            label: "都行",
            x: 50,
            y: 30,
            mag: 3,
            meta: { teaching_style: "balanced" },
        },
        {
            id: "teach_applied",
            label: "偏实践",
            x: 72,
            y: 38,
            mag: 2,
            meta: { teaching_style: "applied_heavy" },
        },
    ],
};

/** Supplementary: bachelor exam / entry route.
 *  Shown after level = "bachelor". storeAsWish=true so answers
 *  flow into diagnosis context rather than LedgerFacts. */
export const NIGHT_BACHELOR_PATH: PickerNight = {
    kind: "picker",
    id: "level_supplement",
    title: "入学路线",
    subtitle: "你准备通过哪条路线申请本科？",
    minPicks: 1,
    maxPicks: 1,
    storeAsWish: true,
    stars: [
        { id: "bp_gaokao", label: "高考", x: 20, y: 34, mag: 3 },
        { id: "bp_ib_ap", label: "IB / AP", x: 42, y: 24, mag: 2 },
        { id: "bp_alevel", label: "A-Level", x: 62, y: 28, mag: 2 },
        { id: "bp_comp", label: "竞赛特招", x: 80, y: 40, mag: 2 },
        { id: "bp_lang", label: "语言直升", x: 28, y: 62, mag: 1 },
        { id: "bp_other", label: "其他", x: 58, y: 68, mag: 1 },
    ],
};

/** Supplementary: master/PhD post-undergrad background.
 *  Shown after level = "master" | "phd". storeAsWish=true. */
export const NIGHT_MASTER_BACKGROUND: PickerNight = {
    kind: "picker",
    id: "level_supplement",
    title: "本科之后",
    subtitle: "本科毕业后,你主要做了什么？",
    minPicks: 1,
    maxPicks: 2,
    storeAsWish: true,
    stars: [
        { id: "mb_work", label: "工作", x: 20, y: 30, mag: 3 },
        { id: "mb_postgrad", label: "读研 / 在读研", x: 48, y: 22, mag: 2 },
        { id: "mb_civil", label: "考公务员", x: 74, y: 32, mag: 2 },
        { id: "mb_comp", label: "参加竞赛 / 项目", x: 28, y: 60, mag: 2 },
        { id: "mb_intern", label: "实习积累", x: 56, y: 64, mag: 2 },
        { id: "mb_gap", label: "间隔 / 备考", x: 80, y: 58, mag: 1 },
    ],
};

/**
 * Decide which nights to render this session, in order. Only the
 * gating night (level) is always required; other questions are skipped
 * if the field is already populated upstream.
 */
export function resolveNights(ctx: ResolverContext): ReadonlyArray<NightDef> {
    const out: NightDef[] = [];
    const acc = ctx.accumulated;

    if (!acc.target_level) out.push(NIGHT_LEVEL);
    if (!acc.target_field) out.push(NIGHT_FIELD);
    if (acc.annual_budget_aud == null) out.push(NIGHT_BUDGET);
    if (!acc.preferred_tags || acc.preferred_tags.length === 0)
        out.push(NIGHT_TAGS);
    if (!acc.city_size && !ctx.assessmentCitySize) out.push(NIGHT_CITY_FALLBACK);
    if (!acc.teaching_style && !ctx.assessmentTeachingStyle)
        out.push(NIGHT_TEACHING_FALLBACK);

    return out;
}
