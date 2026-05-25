// Shared report pipeline used by both the form intake and chat-driven intake.
// Given a fully validated StudentProfile, run the rule engine, build LLM /
// template narratives, save the snapshot, and return the generated code.
//
// Kept here (not inside a "use server" file) so multiple server actions can
// import it without paying the action-export constraints.

import {
    generateBatchNarratives,
    generateReportCode,
    getCandidates,
    recommend,
    renderTemplateNarrative,
    type Candidate,
    type RecommendationNarrative,
    type Score,
    type StudentProfile,
} from "@isp0526/core";
import { saveReport } from "./report-store";
import {
    buildGoogleBatchGenerator,
    isGoogleConfigured,
} from "./ai/google-narrative";

export interface RunReportResult {
    readonly code: string;
}

export async function runReportFromProfile(
    profile: StudentProfile,
): Promise<RunReportResult> {
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

    const { narratives, sources: narrative_sources } = await buildNarratives(
        items,
    );

    await saveReport({
        code,
        created_at: new Date().toISOString(),
        profile,
        set,
        narratives,
        narrative_sources,
        candidates: candidateIndex,
    });

    return { code };
}

async function buildNarratives(
    items: ReadonlyArray<{ score: Score; candidate: Candidate }>,
): Promise<{
    narratives: Map<string, RecommendationNarrative>;
    sources: Map<string, "llm" | "template">;
}> {
    const result = new Map<string, RecommendationNarrative>();
    const sources = new Map<string, "llm" | "template">();

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
                    sources.set(id, "llm");
                }
            }
        } catch {
            // fall through to template
        }
    }

    for (const { score, candidate } of items) {
        if (result.has(score.program_id)) continue;
        result.set(
            score.program_id,
            renderTemplateNarrative(score, candidate, "zh"),
        );
        sources.set(score.program_id, "template");
    }

    return { narratives: result, sources };
}
