import type { Program, University } from "@isp0526/core";

const PROGRAM_CRITICAL = [
    "gpa_min",
    "language_min",
    "tuition",
    "field",
] as const;

export type AuditReport = {
    universities: {
        total: number;
        byCountry: Record<string, number>;
    };
    programs: {
        total: number;
        byCountry: Record<string, number>;
        missingGpa: number;
        missingIelts: number;
        missingTuition: number;
        placeholderNotes: number;
    };
    orphanPrograms: string[];
};

export function auditDataset(
    universities: readonly University[],
    programs: readonly Program[],
): AuditReport {
    const uniById = new Map(universities.map((u) => [u.id, u]));
    const byCountryUni: Record<string, number> = {};
    const byCountryProg: Record<string, number> = {};

    for (const u of universities) {
        byCountryUni[u.country] = (byCountryUni[u.country] ?? 0) + 1;
    }

    let missingGpa = 0;
    let missingIelts = 0;
    let missingTuition = 0;
    let placeholderNotes = 0;
    const orphanPrograms: string[] = [];

    for (const p of programs) {
        const uni = uniById.get(p.university_id);
        if (!uni) {
            orphanPrograms.push(p.id);
            continue;
        }
        byCountryProg[uni.country] = (byCountryProg[uni.country] ?? 0) + 1;
        if (p.gpa_min === undefined) missingGpa++;
        if (!p.language_min?.ielts_overall) missingIelts++;
        if (!p.tuition?.annual) missingTuition++;
        if (p.sources.some((s) => s.note?.includes("placeholder"))) placeholderNotes++;
    }

    return {
        universities: { total: universities.length, byCountry: byCountryUni },
        programs: {
            total: programs.length,
            byCountry: byCountryProg,
            missingGpa,
            missingIelts,
            missingTuition,
            placeholderNotes,
        },
        orphanPrograms,
    };
}
