// Scoring contracts emitted by the rule engine and consumed by the report UI.
//
// Each Score is fully traceable: per-dimension breakdown plus a list of
// human-readable reasons, each carrying at least one source citation.

import { z } from "zod";
import { ProgramIdSchema, UniversityIdSchema } from "./ids";
import { SourceCitationSchema } from "./source";

const unitInterval = z.number().min(0).max(1);
const percentScore = z.number().min(0).max(100);

export const BandTierSchema = z.enum(["stretch", "match", "safety"]);
export type BandTier = z.infer<typeof BandTierSchema>;

export const ScoreBreakdownSchema = z.object({
    academic_fit: unitInterval,
    personality: unitInterval,
    lifestyle: unitInterval,
    career: unitInterval,
    budget: unitInterval,
    tag_boost: unitInterval,
    reputation: unitInterval,
});
export type ScoreBreakdown = z.infer<typeof ScoreBreakdownSchema>;

export const RecommendationReasonSchema = z.object({
    text: z.string().min(1).max(280),
    sources: z.array(SourceCitationSchema).min(1),
});
export type RecommendationReason = z.infer<typeof RecommendationReasonSchema>;

export const ScoreSchema = z.object({
    program_id: ProgramIdSchema,
    university_id: UniversityIdSchema,
    band: BandTierSchema,
    final_score: percentScore,
    breakdown: ScoreBreakdownSchema,
    reasons: z.array(RecommendationReasonSchema).min(3),
});
export type Score = z.infer<typeof ScoreSchema>;

export const RecommendationSetSchema = z.object({
    stretch: z.array(ScoreSchema).max(5),
    match: z.array(ScoreSchema).max(10),
    safety: z.array(ScoreSchema).max(5),
});
export type RecommendationSet = z.infer<typeof RecommendationSetSchema>;
