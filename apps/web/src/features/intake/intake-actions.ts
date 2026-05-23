"use server";

import { redirect } from "next/navigation";
import {
    generateReportCode,
    getCandidates,
    recommend,
    renderTemplateNarrative,
    type Candidate,
    type RecommendationNarrative,
    type Score,
} from "@isp0526/core";
import { parseIntakeFormData, intakeToProfile } from "./intake-schema";
import { saveReport } from "../../lib/report-store";

export async function submitIntakeAction(formData: FormData): Promise<void> {
    const values = parseIntakeFormData(formData);
    const profile = intakeToProfile(values);
    const candidates = getCandidates();
    const { set } = recommend(profile, candidates);

    const code = generateReportCode();
    const allScores: Score[] = [...set.stretch, ...set.match, ...set.safety];
    const candidateIndex = new Map<string, Candidate>();
    for (const c of candidates) candidateIndex.set(c.program.id, c);

    const narratives = new Map<string, RecommendationNarrative>();
    for (const score of allScores) {
        const candidate = candidateIndex.get(score.program_id);
        if (!candidate) continue;
        narratives.set(
            score.program_id,
            renderTemplateNarrative(score, candidate, "zh"),
        );
    }

    await saveReport({
        code,
        created_at: new Date().toISOString(),
        profile,
        set,
        narratives,
        candidates: candidateIndex,
    });

    redirect(`/r/${code}`);
}
