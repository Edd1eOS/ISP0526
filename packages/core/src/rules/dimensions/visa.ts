// Visa feasibility dimension.
//
// Reflects how realistic the student visa pathway is for the candidate's
// country. Pure function: takes the candidate, profile, and a visa-routes
// map (data injected by the aggregator so the dimension stays I/O-free).
//
// Scoring rationale:
//   - Faster typical processing -> higher feasibility
//   - More post-study work years -> higher feasibility (esp. for migration
//     intent profiles)
//   - migration_friendly program tag adds a small bonus
//   - Missing route data yields a neutral 0.5 rather than zero, so a country
//     without curated visa data is not unfairly penalized

import type { Candidate, StudentProfile, VisaRouteMap } from "../../schemas/index";
import { SCORING_WEIGHTS } from "../weights";

export const defaultWeight = SCORING_WEIGHTS.visa_feasibility;

// Anchor points for the processing-time component:
//   <= 6 weeks  -> 1.0
//   >= 20 weeks -> 0.3
const FAST_WEEKS = 6;
const SLOW_WEEKS = 20;
const SLOW_FLOOR = 0.3;

// Post-study work component caps at 4 years for the purposes of scoring.
const PSW_CAP_YEARS = 4;

const MIGRATION_TAG_BONUS = 0.08;

export function score(
    profile: StudentProfile,
    candidate: Candidate,
    routes: VisaRouteMap,
): number {
    const route = routes[candidate.university.country];
    if (!route) return 0.5;

    const processing = processingComponent(route.total_weeks_typical);
    const psw = Math.min(route.post_study_work_years, PSW_CAP_YEARS) / PSW_CAP_YEARS;

    // Weight processing vs PSW by migration intent: a student who explicitly
    // wants to migrate cares more about PSW years than waiting time.
    const migrationIntent = profile.career.migration_intent ?? 3;
    const pswWeight = 0.3 + 0.1 * (migrationIntent - 3); // 0.1..0.5
    const procWeight = 1 - pswWeight;
    let combined = procWeight * processing + pswWeight * psw;

    if (candidate.program.tags.includes("migration_friendly")) {
        combined += MIGRATION_TAG_BONUS;
    }

    return clamp01(combined);
}

export function explain(
    _profile: StudentProfile,
    candidate: Candidate,
    routes: VisaRouteMap,
): string[] {
    const route = routes[candidate.university.country];
    if (!route) {
        return [
            `${candidate.university.country} 的签证路径还未整理，采用中性可行性估值。`,
        ];
    }
    const reasons: string[] = [
        `${route.country_name_zh ?? route.country_name_en} ${route.visa_class}：全流程约 ${route.total_weeks_typical} 周${route.steps ? `，共 ${route.steps.length} 个步骤` : ""}。`,
        `毕业后工作签最长 ${route.post_study_work_years} 年。`,
    ];
    if (candidate.program.tags.includes("migration_friendly")) {
        reasons.push(
            "项目有移民友好标签，可行性面额外加分。",
        );
    }
    return reasons;
}

function processingComponent(weeks: number): number {
    if (weeks <= FAST_WEEKS) return 1;
    if (weeks >= SLOW_WEEKS) return SLOW_FLOOR;
    const t = (weeks - FAST_WEEKS) / (SLOW_WEEKS - FAST_WEEKS);
    return 1 - t * (1 - SLOW_FLOOR);
}

function clamp01(n: number): number {
    return n < 0 ? 0 : n > 1 ? 1 : n;
}
