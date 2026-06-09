import fs from "node:fs";
import path from "node:path";
import {
    ProgramSchema,
    UniversitySchema,
    type Program,
    type University,
} from "@isp0526/core";
import { CORE_DATA } from "./paths";

export type CountryShard = string;
const UNIVERSITY_SHARD_RE = /^universities\.([a-z]{2})\.json$/u;
const PROGRAM_SHARD_RE = /^programs\.([a-z]{2})\.json$/u;

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
        loadJson(path.join(CORE_DATA, `universities.${country}.json`)),
    );
    const programs = validatePrograms(
        loadJson(path.join(CORE_DATA, `programs.${country}.json`)),
    );
    return { universities, programs };
}

export function listProductionShards(): CountryShard[] {
    const universityShards = new Set<string>();
    const programShards = new Set<string>();

    for (const file of fs.readdirSync(CORE_DATA)) {
        const universityMatch = UNIVERSITY_SHARD_RE.exec(file);
        if (universityMatch?.[1]) universityShards.add(universityMatch[1]);

        const programMatch = PROGRAM_SHARD_RE.exec(file);
        if (programMatch?.[1]) programShards.add(programMatch[1]);
    }

    return [...universityShards]
        .filter((country) => programShards.has(country))
        .sort((a, b) => a.localeCompare(b));
}

export function loadAllProduction() {
    const universities: University[] = [];
    const programs: Program[] = [];
    for (const c of listProductionShards()) {
        const shard = loadProduction(c);
        universities.push(...shard.universities);
        programs.push(...shard.programs);
    }
    return { universities, programs };
}

export function verifyProduction(): { ok: boolean; errors: string[]; stats: Record<string, number> } {
    const errors: string[] = [];
    const allUniversityIds = new Set<string>();
    const allProgramIds = new Set<string>();
    const universities: University[] = [];
    const programs: Program[] = [];

    const countries = listProductionShards();
    for (const c of countries) {
        try {
            const shard = loadProduction(c);
            for (const u of shard.universities) {
                if (allUniversityIds.has(u.id)) errors.push(`${c}: duplicate university id ${u.id}`);
                allUniversityIds.add(u.id);
            }
            for (const p of shard.programs) {
                if (allProgramIds.has(p.id)) errors.push(`${c}: duplicate program id ${p.id}`);
                allProgramIds.add(p.id);
            }
            universities.push(...shard.universities);
            programs.push(...shard.programs);
        } catch (e) {
            errors.push(`${c}: ${e instanceof Error ? e.message : String(e)}`);
        }
    }

    for (const p of programs) {
        if (!allUniversityIds.has(p.university_id)) {
            errors.push(`program ${p.id} references missing university ${p.university_id}`);
        }
    }

    return {
        ok: errors.length === 0,
        errors,
        stats: { universities: universities.length, programs: programs.length },
    };
}
