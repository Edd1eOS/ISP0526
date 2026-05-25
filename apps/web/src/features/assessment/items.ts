// 15-item personality + preference assessment, per spec FR-2 (Step 3 in the
// user flow). 10 TIPI items map to Big Five, 5 preference items seed the
// learning + lifestyle + career sub-profiles.
//
// All items are low-pressure Likert-5 ("非常不符合" .. "非常符合") OR a
// short enum choice. No "right" answers. Items are intentionally phrased
// in everyday Chinese, not psychometric jargon.
//
// Scoring is pure: see `scoreAssessment` below. The rule engine consumes
// the resulting `big_five` / `learning` / `lifestyle` / `career` fragments
// via the existing personality / learning / lifestyle / career dimensions.

import type {
    BigFive,
    LearningPreference,
    LifestylePreference,
    CareerPreference,
    CareerInterests,
} from "@isp0526/core";

export const LIKERT_LABELS: ReadonlyArray<string> = [
    "非常不符合",
    "比较不符合",
    "一般",
    "比较符合",
    "非常符合",
];

export type LikertValue = 1 | 2 | 3 | 4 | 5;

export type TipiDim =
    | "openness"
    | "conscientiousness"
    | "extraversion"
    | "agreeableness"
    | "neuroticism";

export interface TipiItem {
    readonly id: string;
    readonly prompt: string;
    readonly dim: TipiDim;
    // When true, low Likert means high dimension (reverse-keyed).
    readonly reverse: boolean;
}

export const TIPI_ITEMS: ReadonlyArray<TipiItem> = [
    { id: "t1", prompt: "我外向、有热情，喜欢和人打交道。", dim: "extraversion", reverse: false },
    { id: "t2", prompt: "我容易批评别人，常常意见不同就争一争。", dim: "agreeableness", reverse: true },
    { id: "t3", prompt: "我做事可靠、自律，定下的事大多能完成。", dim: "conscientiousness", reverse: false },
    { id: "t4", prompt: "我容易焦虑，情绪起伏比较大。", dim: "neuroticism", reverse: false },
    { id: "t5", prompt: "我喜欢尝试新事物，也愿意思考抽象/复杂的问题。", dim: "openness", reverse: false },
    { id: "t6", prompt: "我比较安静、内向，不太爱出风头。", dim: "extraversion", reverse: true },
    { id: "t7", prompt: "我富有同情心，愿意帮别人、为别人着想。", dim: "agreeableness", reverse: false },
    { id: "t8", prompt: "我做事偶尔会粗心、没条理。", dim: "conscientiousness", reverse: true },
    { id: "t9", prompt: "我情绪比较平稳，遇事不容易慌。", dim: "neuroticism", reverse: true },
    { id: "t10", prompt: "比起标新立异，我更偏好传统、稳妥的方式。", dim: "openness", reverse: true },
];

// ---------- RIASEC (Holland) career-interest mini-instrument ----------
// Holland's RIASEC framework (Holland, 1959) is a public-domain theory; the
// items below are authored in-house and are not derived from any copyrighted
// inventory (Self-Directed Search / Strong Interest Inventory are NOT used).
// One item per dimension; each scored as a single Likert 1..5 then normalised
// to 0..1 for the recommender and the result-review surface.
export type RiasecDim =
    | "realistic"
    | "investigative"
    | "artistic"
    | "social"
    | "enterprising"
    | "conventional";

export interface RiasecItem {
    readonly id: string;
    readonly prompt: string;
    readonly dim: RiasecDim;
}

export const RIASEC_ITEMS: ReadonlyArray<RiasecItem> = [
    { id: "r1", prompt: "我喜欢动手做东西、修机器、操作工具或户外作业。", dim: "realistic" },
    { id: "r2", prompt: "我喜欢钻研问题、做实验、分析数据、理解事物背后的原理。", dim: "investigative" },
    { id: "r3", prompt: "我喜欢创作、表达、设计或从事艺术/写作/音乐相关的事。", dim: "artistic" },
    { id: "r4", prompt: "我喜欢和人打交道、帮助别人、教别人、做团队协调。", dim: "social" },
    { id: "r5", prompt: "我喜欢说服、谈判、带头做项目、追求商业上的成功。", dim: "enterprising" },
    { id: "r6", prompt: "我喜欢有条理的工作，按规则把事情整理清楚、做账目或文书。", dim: "conventional" },
];

export type PrefItemId =
    | "p_teaching_style"
    | "p_class_size_small"
    | "p_city_size"
    | "p_migration_intent"
    | "p_fast_pace";

export interface LikertPrefItem {
    readonly kind: "likert";
    readonly id: PrefItemId;
    readonly prompt: string;
    // Anchor copy shown under value 1 and value 5 to make the scale concrete.
    readonly low: string;
    readonly high: string;
}

export interface EnumPrefItem {
    readonly kind: "enum";
    readonly id: PrefItemId;
    readonly prompt: string;
    readonly options: ReadonlyArray<{ value: string; label: string }>;
}

export type PrefItem = LikertPrefItem | EnumPrefItem;

export const PREF_ITEMS: ReadonlyArray<PrefItem> = [
    {
        kind: "enum",
        id: "p_teaching_style",
        prompt: "你更想要的上课风格是？",
        options: [
            { value: "theory_heavy", label: "偏理论" },
            { value: "balanced", label: "都行" },
            { value: "applied_heavy", label: "偏实践" },
        ],
    },
    {
        kind: "likert",
        id: "p_class_size_small",
        prompt: "我更喜欢小班教学（同学少、互动多）。",
        low: "大班也行",
        high: "越小越好",
    },
    {
        kind: "enum",
        id: "p_city_size",
        prompt: "你更想去多大的城市？",
        options: [
            { value: "mega", label: "超大城市" },
            { value: "large", label: "大城市" },
            { value: "medium", label: "中等城市" },
            { value: "small", label: "小城市" },
        ],
    },
    {
        kind: "likert",
        id: "p_migration_intent",
        prompt: "毕业后我希望留在当地工作/移民。",
        low: "想回国",
        high: "很想留下",
    },
    {
        kind: "likert",
        id: "p_fast_pace",
        prompt: "我喜欢快节奏、强度大的学习环境。",
        low: "慢一点更好",
        high: "越紧凑越好",
    },
];

export interface AssessmentAnswers {
    // tipi id -> Likert 1..5
    readonly tipi: Readonly<Record<string, LikertValue>>;
    // riasec id -> Likert 1..5 (optional for back-compat with payloads written
    // before the RIASEC module was added)
    readonly riasec?: Readonly<Record<string, LikertValue>>;
    // pref id -> Likert 1..5 OR enum string
    readonly prefs: Readonly<Record<PrefItemId, LikertValue | string>>;
}

export interface AssessmentResult {
    readonly big_five: BigFive;
    readonly learning: LearningPreference;
    readonly lifestyle: LifestylePreference;
    readonly career: CareerPreference;
}

// Map Likert 1..5 to 0..7 dimension scale used by BigFiveSchema.
function likertTo7(likert: number): number {
    const clamped = Math.max(1, Math.min(5, likert));
    return ((clamped - 1) * 7) / 4;
}

export function scoreAssessment(input: AssessmentAnswers): AssessmentResult {
    // Aggregate TIPI: per dimension, average the two items (reversing the
    // negative-keyed one) on the Likert scale, then convert to 0..7.
    const sums: Record<TipiDim, { sum: number; n: number }> = {
        openness: { sum: 0, n: 0 },
        conscientiousness: { sum: 0, n: 0 },
        extraversion: { sum: 0, n: 0 },
        agreeableness: { sum: 0, n: 0 },
        neuroticism: { sum: 0, n: 0 },
    };
    for (const item of TIPI_ITEMS) {
        const raw = input.tipi[item.id];
        if (raw === undefined) continue;
        const effective = item.reverse ? 6 - raw : raw;
        sums[item.dim].sum += effective;
        sums[item.dim].n += 1;
    }
    const dim = (d: TipiDim): number => {
        const s = sums[d];
        // Fall back to neutral (Likert 3) if both items are missing.
        const avgLikert = s.n > 0 ? s.sum / s.n : 3;
        return Number(likertTo7(avgLikert).toFixed(2));
    };
    const big_five: BigFive = {
        openness: dim("openness"),
        conscientiousness: dim("conscientiousness"),
        extraversion: dim("extraversion"),
        agreeableness: dim("agreeableness"),
        neuroticism: dim("neuroticism"),
    };

    const prefs = input.prefs;
    const learning: LearningPreference = {};
    const lifestyle: LifestylePreference = {};
    const career: CareerPreference = {};

    const ts = prefs.p_teaching_style;
    if (typeof ts === "string" && (ts === "theory_heavy" || ts === "balanced" || ts === "applied_heavy")) {
        learning.teaching_style = ts;
    }
    const cs = prefs.p_class_size_small;
    if (typeof cs === "number") {
        learning.class_size_small = cs as LikertValue;
    }
    const fp = prefs.p_fast_pace;
    if (typeof fp === "number") {
        learning.fast_pace = fp as LikertValue;
    }
    const city = prefs.p_city_size;
    if (typeof city === "string" && (city === "mega" || city === "large" || city === "medium" || city === "small")) {
        lifestyle.city_size = city;
    }
    const mi = prefs.p_migration_intent;
    if (typeof mi === "number") {
        career.migration_intent = mi as LikertValue;
        // Inverse-link: high migration intent implies low return-home pull.
        // This is a coarse proxy until we ask return_home explicitly.
        career.return_home = (6 - mi) as LikertValue;
    }

    // RIASEC: 1 item per dim, normalise Likert 1..5 to 0..1. Missing items
    // default to neutral 0.5 so a partial submission still produces a usable
    // shape. Only attach when at least one RIASEC answer was provided so the
    // back-compat path (no riasec field) leaves career.interests undefined.
    if (input.riasec) {
        const interests: CareerInterests = {};
        let provided = 0;
        for (const item of RIASEC_ITEMS) {
            const raw = input.riasec[item.id];
            if (raw === undefined) continue;
            provided += 1;
            interests[item.dim] = Number(
                (((Math.max(1, Math.min(5, raw)) - 1) / 4)).toFixed(2),
            );
        }
        if (provided > 0) {
            career.interests = interests;
        }
    }

    return { big_five, learning, lifestyle, career };
}
