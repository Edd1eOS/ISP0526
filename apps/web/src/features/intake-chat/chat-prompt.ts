// Shared constants and prompt fragments used by both the Conversation
// Agent (CA) and the Extraction Agent (EA). The full prompt builders live
// in chat-prompt-conversation.ts and chat-prompt-extraction.ts.

import type { FormFieldKey } from "../intake-clarify/clarify-schema";

export const FIELD_LABELS_ZH: Record<FormFieldKey, string> = {
    target_level: "目标学位（bachelor / master / phd）",
    target_field:
        "目标方向（Information Technology / Computing / Data Science / Business / Business Administration / Finance / Civil Engineering / Electrical Engineering / Mechanical Engineering / Design / TESOL）",
    gpa: "学业成绩（GPA、WAM、高考、AP、A-level、IB、证书等任意类型）",
    ielts_overall: "IELTS 总分",
    teaching_style: "学习风格（theory_heavy / balanced / applied_heavy）",
    city_size: "城市规模偏好（mega / large / medium / small）",
    preferred_tags:
        "看重的方面（field_top / migration_friendly / career_pipeline / value_for_money / scholarship_rich / chinese_community 多选）",
};

// Priority order: highest-impact fields first. The LLM uses this to choose
// which gap to ask about next. target_level is required; the rest are
// optional but improve scoring.
export const CHAT_PRIORITY: ReadonlyArray<FormFieldKey> = [
    "target_level",
    "target_field",
    "preferred_tags",
    "gpa",
    "ielts_overall",
    "teaching_style",
    "city_size",
];

// "Enough to recommend" gate. We do not block on every field — chat fatigue
// is real. Once target_level is set AND at least 3 supporting signals are
// captured, the LLM may set done=true on its own.
export const MIN_SUPPORTING_SIGNALS = 3;

export interface AssessmentSummaryForPrompt {
    readonly big_five: {
        readonly openness: number;
        readonly conscientiousness: number;
        readonly extraversion: number;
        readonly agreeableness: number;
        readonly neuroticism: number;
    };
    readonly learning?: {
        readonly teaching_style?: string;
        readonly class_size_small?: number;
        readonly fast_pace?: number;
    };
    readonly lifestyle?: { readonly city_size?: string };
    readonly career?: {
        readonly migration_intent?: number;
        readonly return_home?: number;
        readonly interests?: Readonly<Record<string, number>>;
    };
}

function describeTrait(label: string, score: number): string {
    // score is on 0..7 scale per BigFiveSchema
    if (score >= 5.25) return `${label}偏高(${score.toFixed(1)}/7)`;
    if (score >= 3.75) return `${label}中等(${score.toFixed(1)}/7)`;
    return `${label}偏低(${score.toFixed(1)}/7)`;
}

const RIASEC_ZH: Readonly<Record<string, string>> = {
    realistic: "现实型R",
    investigative: "研究型I",
    artistic: "艺术型A",
    social: "社会型S",
    enterprising: "企业型E",
    conventional: "常规型C",
};

const TEACHING_STYLE_ZH: Readonly<Record<string, string>> = {
    theory_heavy: "偏理论",
    balanced: "都行",
    applied_heavy: "偏实践",
};

const CITY_SIZE_ZH: Readonly<Record<string, string>> = {
    mega: "超大城市",
    large: "大城市",
    medium: "中等城市",
    small: "小城市",
};

export function renderAssessmentBlock(a: AssessmentSummaryForPrompt): string {
    const b = a.big_five;
    const traits = [
        describeTrait("外向性", b.extraversion),
        describeTrait("宜人性", b.agreeableness),
        describeTrait("尽责性", b.conscientiousness),
        describeTrait("情绪稳定性", 7 - b.neuroticism),
        describeTrait("开放性", b.openness),
    ].join("、");

    const interests = a.career?.interests;
    let riasecLine = "";
    if (interests) {
        const ranked = Object.entries(interests)
            .filter((e): e is [string, number] => typeof e[1] === "number")
            .sort((x, y) => y[1] - x[1]);
        if (ranked.length > 0) {
            const top = ranked
                .slice(0, 3)
                .map(
                    ([k, v]) =>
                        `${RIASEC_ZH[k] ?? k}${Math.round(v * 100)}%`,
                )
                .join("、");
            riasecLine = `\n职业兴趣 RIASEC 前三：${top}`;
        }
    }

    const learnBits: string[] = [];
    if (a.learning?.teaching_style)
        learnBits.push(
            `教学风格=${TEACHING_STYLE_ZH[a.learning.teaching_style] ?? a.learning.teaching_style}`,
        );
    if (typeof a.learning?.class_size_small === "number")
        learnBits.push(`小班偏好=${a.learning.class_size_small}/5`);
    if (typeof a.learning?.fast_pace === "number")
        learnBits.push(`节奏紧凑度=${a.learning.fast_pace}/5`);

    const lifeBits: string[] = [];
    if (a.lifestyle?.city_size)
        lifeBits.push(
            `城市规模=${CITY_SIZE_ZH[a.lifestyle.city_size] ?? a.lifestyle.city_size}`,
        );

    const careerBits: string[] = [];
    if (typeof a.career?.migration_intent === "number")
        careerBits.push(`留下意愿=${a.career.migration_intent}/5`);

    const lines: string[] = [];
    if (learnBits.length > 0)
        lines.push(`学习偏好：${learnBits.join("，")}`);
    if (lifeBits.length > 0)
        lines.push(`生活偏好：${lifeBits.join("，")}`);
    if (careerBits.length > 0)
        lines.push(`职业意愿：${careerBits.join("，")}`);

    const prefBlock = lines.length > 0 ? `\n${lines.join("\n")}` : "";

    return `\n学生已完成 Big Five (TIPI) 人格 + Holland RIASEC 职业兴趣 + 学习/生活偏好测评，结果如下：\n${traits}${riasecLine}${prefBlock}\n\n你必须把这份测评结果用在对话里：\n- 第一条消息里就要自然地提一句你"看到测评了"，挑 1 个最突出的特征（Big Five 或 RIASEC 都行）作为切入点，例如："看你研究型分挺高，估计想去研究密度大的项目吧。"\n- 不要再追问 teaching_style 或 city_size — 已经由测评得到，patch 也不要重写这些字段。\n- 在询问 target_field 时，可以参考 RIASEC：研究型/艺术型/社会型/企业型/现实型/常规型分别对应不同方向，你可以给学生推荐与他高分类型契合的方向作为 quick_replies 默认前几项（例如研究型可优先推 Data Science / Computer Science / Engineering，社会型可推 Education / Public Health）。\n- 整个对话要呼应学生的性格 + 兴趣特质。`;
}

export function renderPhaseBlock(
    phase:
        | "OPENING"
        | "GATHERING_CORE"
        | "GATHERING_SOFT"
        | "READY_TO_RECOMMEND",
    hasAssessment: boolean,
): string {
    switch (phase) {
        case "OPENING":
            return hasAssessment
                ? "这是第一轮对话，学生还没说话。开场必须先用一句话回应学生的测评结果（挑 1 个最突出特质），紧接着抛出第一个未锁定的最高优先级问题（看『剩余优先级缺口』列表第一项）。绝对不要再说\"我们做个测评吧\"。本轮 done 必须为 false——即使 accumulated 看起来已经齐全，也要先问一个问题确认而不是直接结束。"
                : "这是第一轮对话，学生还没说话。一句温和的开场白 + 第一个未锁定的最高优先级问题（看『剩余优先级缺口』列表第一项）。本轮 done 必须为 false——即使 accumulated 看起来已经齐全，也要先问一个问题确认而不是直接结束。";
        case "GATHERING_CORE":
            return "核心字段（target_level / target_field）还有缺口。集中精力把核心问完，每轮只问一个；不要插入 teaching_style / city_size / preferred_tags 这类软性字段。";
        case "GATHERING_SOFT":
            return "核心三项已经齐了，可以问 1-2 个软性字段（preferred_tags / gpa / ielts_overall）来提高推荐准度。但每问完一项就评估一次是否够了，不要把学生问烦。";
        case "READY_TO_RECOMMEND":
            return "信息已经足够推荐。这一轮要么主动收尾（done=true，reply 用一句简短的\"好的，我去给你拉推荐了。\"），要么如果学生还在主动补充就接住再决定。绝对不要再发起新问题。";
    }
}
