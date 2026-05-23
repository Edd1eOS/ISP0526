"use server";

import { redirect } from "next/navigation";
import {
    generateBatchNarratives,
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
import {
    buildGoogleBatchGenerator,
    isGoogleConfigured,
} from "../../lib/ai/google-narrative";

export async function submitIntakeAction(formData: FormData): Promise<void> {
    const values = parseIntakeFormData(formData);
    const profile = intakeToProfile(values);
    const candidates = getCandidates();
    const { set } = recommend(profile, candidates);

    const code = generateReportCode();
    const allScores: Score[] = [...set.stretch, ...set.match, ...set.safety];
    const candidateIndex = new Map<string, Candidate>();
    for (const c of candidates) candidateIndex.set(c.program.id, c);

    const items = allScores
        .map((score) => {
            const candidate = candidateIndex.get(score.program_id);
            return candidate ? { score, candidate } : null;
        })
        .filter((x): x is { score: Score; candidate: Candidate } => x !== null);

    const narratives = await buildNarratives(items);

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

// Attempt LLM batch generation; fall back to the deterministic template for
// any item the LLM rejected, failed on, or wasn't configured to handle. The
// template is also the zero-cost path when no API key is present.
async function buildNarratives(
    items: ReadonlyArray<{ score: Score; candidate: Candidate }>,
): Promise<Map<string, RecommendationNarrative>> {
    const result = new Map<string, RecommendationNarrative>();

    if (isGoogleConfigured()) {
        try {
            const r = await generateBatchNarratives({
                locale: "zh",
                items,
                generate: buildGoogleBatchGenerator(),
            });
            if (r.ok) {
                for (const [id, narrative] of r.value.narratives) {
                    result.set(id, narrative);
                }
                if (r.value.rejected.length > 0) {
                    // eslint-disable-next-line no-console
                    console.warn(
                        `[narrative] LLM rejected ${r.value.rejected.length} item(s); falling back to template`,
                        r.value.rejected,
                    );
                }
            } else {
                // eslint-disable-next-line no-console
                console.warn(
                    `[narrative] LLM batch failed (${r.error.kind}); falling back to template`,
                    r.error.message,
                );
            }
        } catch (cause) {
            // eslint-disable-next-line no-console
            console.warn(
                "[narrative] LLM call threw; falling back to template",
                cause,
            );
        }
    }

    for (const { score, candidate } of items) {
        if (result.has(score.program_id)) continue;
        result.set(
            score.program_id,
            renderTemplateNarrative(score, candidate, "zh"),
        );
    }

    return result;
}
