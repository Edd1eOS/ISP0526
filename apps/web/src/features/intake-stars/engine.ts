// QuestionEngine — fixed question selector over a KnowledgeLedger.
//
// Only the three mandatory structured pickers are handled here. All
// subsequent questions are generated adaptively by an LLM in the stage
// component. Conflict resolution is a separate export so the stage can
// call it after the adaptive phase completes.
//
// Fixed question order:
//   1. 学习阶段 (level picker)
//   2. 阶段补充 (level-specific supplementary: bachelor path / master background)
//   3. 方向 (field picker)
//
// Returns null once the three fixed questions are answered, signalling
// the stage to enter the adaptive LLM-question phase.

import type { KnowledgeLedger, LedgerFacts, Source } from "./ledger";
import { listConflicts } from "./ledger";
import {
    NIGHT_LEVEL,
    NIGHT_FIELD,
    NIGHT_BACHELOR_PATH,
    NIGHT_MASTER_BACKGROUND,
} from "./nights";
import type { PickerNight } from "./types";

export interface PickerQuestion {
    readonly kind: "picker";
    readonly id: string;
    readonly template: PickerNight;
}

export interface ResolveQuestionOption {
    readonly value: unknown;
    readonly label: string;
    readonly source: Source;
    readonly confidence?: number;
}

export interface ResolveQuestion {
    readonly kind: "resolve";
    readonly id: string;
    readonly field: keyof LedgerFacts;
    readonly fieldLabel: string;
    readonly options: ReadonlyArray<ResolveQuestionOption>;
}

export type Question = PickerQuestion | ResolveQuestion;

// ---------------------------------------------------------------------------
// Label helpers (used for conflict resolution display only)
// ---------------------------------------------------------------------------

function fieldLabel(field: keyof LedgerFacts): string {
    return (
        ({
            target_level: "学习阶段",
            target_field: "方向",
            gpa: "GPA",
            ielts_overall: "雅思",
            annual_budget_aud: "预算",
            teaching_style: "教学风格",
            city_size: "城市规模",
            preferred_tags: "看重的事",
        } as Record<keyof LedgerFacts, string>)[field]
    );
}

function valueLabel(field: keyof LedgerFacts, value: unknown): string {
    if (field === "target_field" && typeof value === "string") {
        const map: Readonly<Record<string, string>> = {
            Computing: "计算机 / 工程",
            Business: "商科 / 金融",
            Design: "设计 / 创意",
            "Data Science": "数据 / 分析",
            TESOL: "教育 / 语言",
        };
        return map[value] ?? value;
    }
    if (field === "city_size" && typeof value === "string") {
        return (
            ({ mega: "超大城市", large: "大城市", medium: "中型城市", small: "小城" } as Record<string, string>)[value] ?? value
        );
    }
    if (field === "annual_budget_aud" && typeof value === "number") {
        const wan = (value / 10000).toFixed(value % 10000 === 0 ? 0 : 1);
        return `${wan} 万 AUD/年`;
    }
    if (field === "target_level" && typeof value === "string") {
        return ({ bachelor: "本科", master: "硕士", phd: "博士" } as Record<string, string>)[value] ?? value;
    }
    if (field === "teaching_style" && typeof value === "string") {
        return (
            ({ theory_heavy: "偏理论", balanced: "平衡", applied_heavy: "偏实践" } as Record<string, string>)[value] ?? value
        );
    }
    if (Array.isArray(value)) return value.join(" + ");
    return String(value);
}

// ---------------------------------------------------------------------------
// wishedSkip — true if the user explicitly answered this question via text
// ---------------------------------------------------------------------------

function wishedSkip(ledger: KnowledgeLedger, questionId: string): boolean {
    return (ledger.committedWishes ?? []).includes(questionId);
}

// ---------------------------------------------------------------------------
// nextFixedQuestion — deterministic fixed-question walk
// ---------------------------------------------------------------------------

export function nextFixedQuestion(ledger: KnowledgeLedger): PickerQuestion | null {
    const f = ledger.facts;

    // 1. Learning level (always required first)
    if (!f.target_level && !wishedSkip(ledger, "level")) {
        return { kind: "picker", id: "level", template: NIGHT_LEVEL };
    }

    // 2. Level-specific supplementary question
    //    Level must be known (either picked or wish-skipped).
    if (!wishedSkip(ledger, "level_supplement")) {
        const level = f.target_level?.value ?? null;
        if (level === "bachelor") {
            return { kind: "picker", id: "level_supplement", template: NIGHT_BACHELOR_PATH };
        }
        if (level === "master" || level === "phd") {
            return { kind: "picker", id: "level_supplement", template: NIGHT_MASTER_BACKGROUND };
        }
        // If level was wish-skipped (no fact), skip supplement too.
        if (wishedSkip(ledger, "level")) {
            // Level unknown — skip supplement (LLM can ask about background contextually)
        } else {
            // Level not yet set and not wish-skipped — don't show supplement yet
            return null;
        }
    }

    // 3. Field of study
    if (!f.target_field && !wishedSkip(ledger, "field")) {
        return { kind: "picker", id: "field", template: NIGHT_FIELD };
    }

    return null;
}

// ---------------------------------------------------------------------------
// nextConflictQuestion — emits a resolve question when two sources disagree.
// Called by the stage AFTER the adaptive phase completes.
// ---------------------------------------------------------------------------

export function nextConflictQuestion(ledger: KnowledgeLedger): ResolveQuestion | null {
    const conflicts = listConflicts(ledger);
    for (const conf of conflicts) {
        const options: ResolveQuestionOption[] = [
            {
                value: conf.primaryValue,
                label: valueLabel(conf.field, conf.primaryValue),
                source: conf.primarySource,
            },
            ...conf.alternatives.map((a) => ({
                value: a.value,
                label: valueLabel(conf.field, a.value),
                source: a.source,
                ...(a.confidence != null ? { confidence: a.confidence } : {}),
            })),
        ];
        return {
            kind: "resolve",
            id: `resolve_${conf.field}`,
            field: conf.field,
            fieldLabel: fieldLabel(conf.field),
            options,
        };
    }
    return null;
}
