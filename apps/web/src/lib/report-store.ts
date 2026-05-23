// Phase 1 report store: in-memory Map keyed by report code. Single-process,
// non-persistent — fine for local dev and the tutor demo. Replace with
// Supabase before any real deployment.

import type {
    Candidate,
    RecommendationNarrative,
    RecommendationSet,
    ReportCode,
    Score,
    StudentProfile,
} from "@isp0526/core";

export interface ReportSnapshot {
    readonly code: ReportCode;
    readonly created_at: string;
    readonly profile: StudentProfile;
    readonly set: RecommendationSet;
    readonly narratives: ReadonlyMap<string, RecommendationNarrative>;
    readonly candidates: ReadonlyMap<string, Candidate>;
}

declare global {
    // eslint-disable-next-line no-var
    var __isp_report_store: Map<string, ReportSnapshot> | undefined;
}

function store(): Map<string, ReportSnapshot> {
    if (!globalThis.__isp_report_store) {
        globalThis.__isp_report_store = new Map();
    }
    return globalThis.__isp_report_store;
}

export function saveReport(snapshot: ReportSnapshot): void {
    store().set(snapshot.code, snapshot);
}

export function loadReport(code: string): ReportSnapshot | undefined {
    return store().get(code);
}

export function narrativesByScore(
    snapshot: ReportSnapshot,
    score: Score,
): RecommendationNarrative | undefined {
    return snapshot.narratives.get(score.program_id);
}

export function candidateByScore(
    snapshot: ReportSnapshot,
    score: Score,
): Candidate | undefined {
    return snapshot.candidates.get(score.program_id);
}
