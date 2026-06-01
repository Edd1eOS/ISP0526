// Career fit dimension.
//
// Rewards programs whose academic field and tags align with the student's
// stated direction / career intent:
//   target_field      -> program.field affinity
//   migration_intent  -> migration_friendly tag
//   internship signal -> career_pipeline tag
// Salary sensitivity is reserved for a future pass once we ship outcome data.

import type { Candidate, StudentProfile } from "../../schemas/index";
import { SCORING_WEIGHTS } from "../weights";

export const defaultWeight = SCORING_WEIGHTS.career;

const NEUTRAL = 0.5;

const FIELD_GROUPS: ReadonlyArray<ReadonlySet<string>> = [
    new Set([
        "information technology",
        "computing",
        "computer science",
        "software engineering",
        "artificial intelligence",
        "human computer interaction",
    ]),
    new Set([
        "data science",
        "business analytics",
        "statistics",
        "artificial intelligence",
    ]),
    new Set([
        "business",
        "business administration",
        "management",
        "business analytics",
        "economics",
    ]),
    new Set(["finance", "economics"]),
    new Set([
        "civil engineering",
        "electrical engineering",
        "mechanical engineering",
        "engineering",
    ]),
    new Set(["design", "architecture", "human computer interaction"]),
    new Set(["tesol", "education"]),
    new Set([
        "environmental science",
        "forestry",
        "science",
        "bioinformatics",
    ]),
    new Set(["public health", "health"]),
];

export function score(profile: StudentProfile, candidate: Candidate): number {
    const { career } = profile;
    const tags = new Set(candidate.program.tags);
    const parts: number[] = [];

    const fieldFit = fieldAffinity(
        profile.academic.target_field,
        candidate.program.field,
    );
    if (fieldFit !== undefined) {
        parts.push(fieldFit);
    }

    if (career.migration_intent !== undefined) {
        const intent = (career.migration_intent - 1) / 4; // 0..1
        const programOffers = tags.has("migration_friendly") ? 1 : 0;
        // High intent + offered = 1; high intent + missing = 0.
        parts.push(1 - Math.abs(intent - programOffers));
    }

    if (career.internship_importance !== undefined) {
        const want = (career.internship_importance - 1) / 4;
        const offers = tags.has("career_pipeline") ? 1 : 0;
        parts.push(1 - Math.abs(want - offers));
    }

    if (parts.length === 0) return NEUTRAL;
    return clamp01(parts.reduce((a, b) => a + b, 0) / parts.length);
}

export function explain(
    profile: StudentProfile,
    candidate: Candidate,
): string[] {
    const reasons: string[] = [];
    const tags = new Set(candidate.program.tags);
    const { career } = profile;
    const targetField = profile.academic.target_field;

    if (targetField) {
        const fieldFit = fieldAffinity(targetField, candidate.program.field) ?? 0;
        reasons.push(
            fieldFit >= 0.85
                ? `项目方向（${fieldLabel(candidate.program.field)}）与你想读的${fieldLabel(targetField)}接近。`
                : `项目方向（${fieldLabel(candidate.program.field)}）与你想读的${fieldLabel(targetField)}差距较大。`,
        );
    }

    if (career.migration_intent !== undefined && career.migration_intent >= 4) {
        reasons.push(
            tags.has("migration_friendly")
                ? "项目有移民友好标签，与你的留下意愿契合。"
                : "项目未标记移民友好，需衡量你的留下需求。",
        );
    }
    if (
        career.internship_importance !== undefined &&
        career.internship_importance >= 4
    ) {
        reasons.push(
            tags.has("career_pipeline")
                ? "项目拥有明确的就业输送管道，能支撑你的实习优先项。"
                : "项目未提及专门的就业输送，建议额外物色实习机会。",
        );
    }
    if (reasons.length === 0) {
        reasons.push("未提供就业偏好，采用中性匹配估值。");
    }
    return reasons;
}

function fieldAffinity(
    targetField: string | undefined,
    programField: string,
): number | undefined {
    if (!targetField) return undefined;
    const target = normalizeField(targetField);
    const program = normalizeField(programField);
    if (target === program) return 1;
    if (target.includes(program) || program.includes(target)) return 0.85;

    for (const group of FIELD_GROUPS) {
        if (group.has(target) && group.has(program)) return 0.9;
    }

    return 0.15;
}

function fieldLabel(s: string): string {
    const labels: Record<string, string> = {
        "Information Technology": "信息技术",
        Computing: "计算机",
        "Computer Science": "计算机科学",
        "Data Science": "数据科学",
        "Business Analytics": "商业分析",
        Business: "商科",
        "Business Administration": "工商管理",
        Finance: "金融",
        Economics: "经济学",
        "Civil Engineering": "土木工程",
        "Electrical Engineering": "电气工程",
        "Mechanical Engineering": "机械工程",
        Engineering: "工程",
        Design: "设计",
        Architecture: "建筑",
        TESOL: "教育 / 语言",
        Education: "教育",
        "Public Health": "公共卫生",
        "Environmental Science": "环境科学",
        Statistics: "统计",
        "Artificial Intelligence": "人工智能",
        "Software Engineering": "软件工程",
        "Human Computer Interaction": "人机交互",
        Bioinformatics: "生物信息",
        Forestry: "林业",
        Science: "自然科学",
    };
    return labels[s] ?? s;
}

function normalizeField(s: string): string {
    return s.trim().toLowerCase();
}

function clamp01(n: number): number {
    return n < 0 ? 0 : n > 1 ? 1 : n;
}
