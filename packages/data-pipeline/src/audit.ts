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
        genericSourcePrograms: number;
        masterWithSteppingStone: number;
        missingIeltsByCountry: Record<string, number>;
        missingTuitionByCountry: Record<string, number>;
        placeholderNotesByCountry: Record<string, number>;
        genericSourceProgramsByCountry: Record<string, number>;
        masterWithSteppingStoneByCountry: Record<string, number>;
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
    let genericSourcePrograms = 0;
    let masterWithSteppingStone = 0;
    const missingIeltsByCountry: Record<string, number> = {};
    const missingTuitionByCountry: Record<string, number> = {};
    const placeholderNotesByCountry: Record<string, number> = {};
    const genericSourceProgramsByCountry: Record<string, number> = {};
    const masterWithSteppingStoneByCountry: Record<string, number> = {};
    const orphanPrograms: string[] = [];

    for (const p of programs) {
        const uni = uniById.get(p.university_id);
        if (!uni) {
            orphanPrograms.push(p.id);
            continue;
        }
        byCountryProg[uni.country] = (byCountryProg[uni.country] ?? 0) + 1;
        if (p.gpa_min === undefined) missingGpa++;
        if (!p.language_min?.ielts_overall) {
            missingIelts++;
            increment(missingIeltsByCountry, uni.country);
        }
        if (!p.tuition?.annual) {
            missingTuition++;
            increment(missingTuitionByCountry, uni.country);
        }
        if (p.sources.some((s) => s.note?.toLowerCase().includes("placeholder"))) {
            placeholderNotes++;
            increment(placeholderNotesByCountry, uni.country);
        }
        if (p.sources.some((s) => s.kind === "url" && s.url && isGenericSourceUrl(s.url))) {
            genericSourcePrograms++;
            increment(genericSourceProgramsByCountry, uni.country);
        }
        if (p.level === "master" && p.tags.includes("stepping_stone")) {
            masterWithSteppingStone++;
            increment(masterWithSteppingStoneByCountry, uni.country);
        }
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
            genericSourcePrograms,
            masterWithSteppingStone,
            missingIeltsByCountry,
            missingTuitionByCountry,
            placeholderNotesByCountry,
            genericSourceProgramsByCountry,
            masterWithSteppingStoneByCountry,
        },
        orphanPrograms,
    };
}

function increment(record: Record<string, number>, key: string): void {
    record[key] = (record[key] ?? 0) + 1;
}

const GENERIC_SOURCE_PATH_SEGMENTS = new Set([
    "admissions",
    "apply",
    "courses",
    "degree",
    "degrees",
    "education",
    "future-students",
    "homepage",
    "postgraduate",
    "program",
    "programs",
    "programmes",
    "school",
    "study",
    "undergraduate",
]);

function isGenericSourceUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        const segments = parsed.pathname.split("/").filter(Boolean);
        if (segments.length === 0) return true;
        const firstSegment = segments[0];
        if (segments.length === 1 && firstSegment !== undefined && GENERIC_SOURCE_PATH_SEGMENTS.has(firstSegment)) {
            return true;
        }
        if (
            segments.length <= 2 &&
            segments.every((segment) => GENERIC_SOURCE_PATH_SEGMENTS.has(segment))
        ) {
            return true;
        }
        return false;
    } catch {
        return false;
    }
}
