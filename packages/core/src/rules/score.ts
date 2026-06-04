// Aggregator: combine all dimension scores into a single Score record per
// candidate, including the per-dimension breakdown, a final 0..100 score, the
// band classification, and a list of cited reasons.
//
// The aggregator is the only place that knows about all dimensions; UI and AI
// layers consume `Score` and never re-import individual dimensions.

import {
    ScoreSchema,
    type Candidate,
    type RecommendationReason,
    type Score,
    type ScoreBreakdown,
    type StudentProfile,
    type VisaRouteMap,
} from "../schemas/index";
import { getVisaRoutes } from "../data/index";
import { classifyApplicationBand } from "./bands";
import {
    score as academicFitScore,
    explain as academicFitExplain,
} from "./dimensions/academic-fit";
import {
    score as personalityScore,
    explain as personalityExplain,
} from "./dimensions/personality";
import {
    score as lifestyleScore,
    explain as lifestyleExplain,
} from "./dimensions/lifestyle";
import {
    score as careerScore,
    explain as careerExplain,
} from "./dimensions/career";
import {
    score as budgetScore,
    explain as budgetExplain,
} from "./dimensions/budget";
import {
    score as tagBoostScore,
    explain as tagBoostExplain,
} from "./dimensions/tag-boost";
import {
    score as reputationScore,
    explain as reputationExplain,
} from "./dimensions/reputation";
import {
    score as visaScore,
    explain as visaExplain,
} from "./dimensions/visa";
import { modulateWeights, type Weights } from "./modulate";

type DimensionId =
    | "academic_fit"
    | "personality"
    | "lifestyle"
    | "career"
    | "budget"
    | "tag_boost"
    | "reputation"
    | "visa_feasibility";

function wrapReasons(
    dimension: DimensionId,
    lines: string[],
    candidate: Candidate,
): RecommendationReason[] {
    const ruleId = `rule:${dimension}`;
    const dataSources = [
        ...candidate.program.sources,
        ...candidate.university.sources,
    ];
    return lines.map((text) => ({
        text,
        sources: [
            { source_id: ruleId, kind: "rule", rule_id: ruleId },
            // Surface one data source so every recommendation cites a fact.
            ...(dataSources[0] ? [dataSources[0]] : []),
        ],
    }));
}

export function scoreCandidate(
    profile: StudentProfile,
    candidate: Candidate,
    routes: VisaRouteMap = getVisaRoutes(),
): Score {
    const breakdown: ScoreBreakdown = {
        academic_fit: academicFitScore(profile, candidate),
        personality: personalityScore(profile, candidate),
        lifestyle: lifestyleScore(profile, candidate),
        career: careerScore(profile, candidate),
        budget: budgetScore(profile, candidate),
        tag_boost: tagBoostScore(profile, candidate),
        reputation: reputationScore(profile, candidate),
        visa_feasibility: visaScore(profile, candidate, routes),
    };

    const weights = modulateWeights(profile);
    const finalScore = weightedSum(breakdown, weights) * 100;

    const reasons: RecommendationReason[] = [
        ...wrapReasons("academic_fit", academicFitExplain(profile, candidate), candidate),
        ...wrapReasons("personality", personalityExplain(profile, candidate), candidate),
        ...wrapReasons("lifestyle", lifestyleExplain(profile, candidate), candidate),
        ...wrapReasons("career", careerExplain(profile, candidate), candidate),
        ...wrapReasons("budget", budgetExplain(profile, candidate), candidate),
        ...wrapReasons("tag_boost", tagBoostExplain(profile, candidate), candidate),
        ...wrapReasons("reputation", reputationExplain(profile, candidate), candidate),
        ...wrapReasons("visa_feasibility", visaExplain(profile, candidate, routes), candidate),
    ];

    return ScoreSchema.parse({
        program_id: candidate.program.id,
        university_id: candidate.university.id,
        band: classifyApplicationBand(profile, candidate, breakdown.academic_fit),
        final_score: Math.round(finalScore * 100) / 100,
        breakdown,
        reasons,
    });
}

function weightedSum(breakdown: ScoreBreakdown, weights: Weights): number {
    return (
        breakdown.academic_fit * weights.academic_fit +
        breakdown.personality * weights.personality +
        breakdown.lifestyle * weights.lifestyle +
        breakdown.career * weights.career +
        breakdown.budget * weights.budget +
        breakdown.tag_boost * weights.tag_boost +
        breakdown.reputation * weights.reputation +
        breakdown.visa_feasibility * weights.visa_feasibility
    );
}
