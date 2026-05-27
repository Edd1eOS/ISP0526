// Authored constellation definitions. Star positions are hand-placed for
// composition; if you re-balance a cluster, render the page locally and
// eyeball it - there is no automatic layout.
//
// Every star whose pick should influence the downstream ClarifyPatch
// carries a `meta` block; bare flavour stars omit it.
//
// At runtime, `resolveNights()` walks the candidate pool and only
// returns the nights whose target field is still missing in the
// accumulated patch / assessment. The free-input astrolabe is rendered
// as a persistent overlay during the picking phase, not as a night.

import type {
    BudgetNight,
    FreeWishConfig,
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
            id: "level_bachelor",
            label: "本科",
            x: 26,
            y: 36,
            mag: 3,
            meta: { target_level: "bachelor" },
        },
        {
            id: "level_master",
            label: "硕士",
            x: 50,
            y: 28,
            mag: 3,
            meta: { target_level: "master" },
        },
        {
            id: "level_phd",
            label: "博士 / 研究型",
            x: 74,
            y: 38,
            mag: 2,
            meta: { target_level: "phd" },
        },
    ],
};

/** Field of study. */
export const NIGHT_FIELD: PickerNight = {
    kind: "picker",
    id: "field",
    title: "方向",
    subtitle: "把你向往的领域点亮,1 到 3 颗",
    minPicks: 1,
    maxPicks: 3,
    stars: [
        {
            id: "cs_eng",
            label: "计算机 / 工程",
            x: 22,
            y: 32,
            mag: 3,
            meta: { target_field: "Computing" },
        },
        {
            id: "business",
            label: "商科 / 金融",
            x: 48,
            y: 24,
            mag: 2,
            meta: { target_field: "Business" },
        },
        {
            id: "design",
            label: "设计 / 创意",
            x: 70,
            y: 36,
            mag: 2,
            meta: { target_field: "Design" },
        },
        {
            id: "data",
            label: "数据 / 分析",
            x: 14,
            y: 50,
            mag: 2,
            meta: { target_field: "Data Science" },
        },
        {
            id: "humanities",
            label: "人文 / 社科",
            x: 34,
            y: 58,
            mag: 2,
        },
        {
            id: "science",
            label: "自然科学",
            x: 60,
            y: 62,
            mag: 2,
        },
        {
            id: "health",
            label: "医学 / 健康",
            x: 80,
            y: 56,
            mag: 1,
        },
        {
            id: "education",
            label: "教育 / 语言",
            x: 50,
            y: 78,
            mag: 1,
            meta: { target_field: "TESOL" },
        },
    ],
};

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

/** Free-input astrolabe configuration. Rendered as a persistent
 * overlay during the picking phase; never a night, never gates
 * advance. */
export const FREE_WISH_CONFIG: FreeWishConfig = {
    maxChars: 280,
    label: "自由感知",
    placeholder: "还有什么想让我知道的？比如:想跟着某个老师做研究、家人希望我离亲戚近一点……",
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
