import fs from "node:fs";
import {
    ProgramSchema,
    UniversitySchema,
    type Program,
    type University,
} from "@isp0526/core";
import { CORE_DATA } from "./paths";

export type CountryShard = "au" | "uk" | "ca";

export function loadJson<T>(filePath: string): T {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
}

export function validateUniversities(rows: unknown[]): University[] {
    return UniversitySchema.array().parse(rows);
}

export function validatePrograms(rows: unknown[]): Program[] {
    return ProgramSchema.array().parse(rows);
}

export function loadProduction(country: CountryShard) {
    const universities = validateUniversities(
        loadJson(`${CORE_DATA}/universities.${country}.json`),
    );
    const programs = validatePrograms(loadJson(`${CORE_DATA}/programs.${country}.json`));
    return { universities, programs };
}

export function loadAllProduction() {
    const countries: CountryShard[] = ["au", "uk", "ca"];
    const universities: University[] = [];
    const programs: Program[] = [];
    for (const c of countries) {
        const shard = loadProduction(c);
        universities.push(...shard.universities);
        programs.push(...shard.programs);
    }
    return { universities, programs };
}

export function verifyProduction(): { ok: boolean; errors: string[]; stats: Record<string, number> } {
    const errors: string[] = [];
    let uniCount = 0;
    let progCount = 0;
    for (const c of ["au", "uk", "ca"] as const) {
        try {
            const { universities, programs } = loadProduction(c);
            uniCount += universities.length;
            progCount += programs.length;
            const uniIds = new Set(universities.map((u) => u.id));
            for (const p of programs) {
                if (!uniIds.has(p.university_id)) {
                    errors.push(`${c}: program ${p.id} references missing university ${p.university_id}`);
                }
            }
            const progIds = new Set<string>();
            for (const p of programs) {
                if (progIds.has(p.id)) errors.push(`${c}: duplicate program id ${p.id}`);
                progIds.add(p.id);
            }
        } catch (e) {
            errors.push(`${c}: ${e instanceof Error ? e.message : String(e)}`);
        }
    }
    return {
        ok: errors.length === 0,
        errors,
        stats: { universities: uniCount, programs: progCount },
    };
}
