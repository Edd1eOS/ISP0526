import fs from "node:fs";
import path from "node:path";
import type { Program, University } from "@isp0526/core";
import { CORE_DATA, DRAFTS_DIR, REPORTS_DIR } from "./paths";
import { validatePrograms, validateUniversities } from "./validate";
import {
    AU_EXPANSION,
    CA_EXPANSION,
    UK_EXPANSION,
    programsForUni,
    uniToUniversity,
} from "./seeds/expansion";

type CountryShard = "au" | "uk" | "ca";

function shardForCountry(country: string): CountryShard {
    if (country === "AU") return "au";
    if (country === "UK") return "uk";
    return "ca";
}

function mergeById<T extends { id: string }>(existing: readonly T[], incoming: readonly T[]): T[] {
    const map = new Map(existing.map((r) => [r.id, r]));
    for (const row of incoming) map.set(row.id, row);
    return [...map.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export function generateExpansionDrafts() {
    const allSeeds = [...AU_EXPANSION, ...UK_EXPANSION, ...CA_EXPANSION];
    const newUniversities = allSeeds.map((s) => uniToUniversity(s));
    const newPrograms = allSeeds.flatMap((s) => programsForUni(s));

    const shards: Record<CountryShard, { universities: University[]; programs: Program[] }> = {
        au: { universities: [], programs: [] },
        uk: { universities: [], programs: [] },
        ca: { universities: [], programs: [] },
    };

    for (const u of newUniversities) {
        shards[shardForCountry(u.country)].universities.push(u);
    }
    for (const p of newPrograms) {
        const uni = newUniversities.find((u) => u.id === p.university_id);
        if (!uni) continue;
        shards[shardForCountry(uni.country)].programs.push(p);
    }

    fs.mkdirSync(DRAFTS_DIR, { recursive: true });
    fs.mkdirSync(REPORTS_DIR, { recursive: true });

    const summary: string[] = [];
    for (const c of ["au", "uk", "ca"] as const) {
        const prodUni = validateUniversities(
            JSON.parse(fs.readFileSync(path.join(CORE_DATA, `universities.${c}.json`), "utf-8")),
        );
        const prodProg = validatePrograms(
            JSON.parse(fs.readFileSync(path.join(CORE_DATA, `programs.${c}.json`), "utf-8")),
        );

        const mergedUni = validateUniversities(mergeById(prodUni, shards[c].universities));
        const mergedProg = validatePrograms(mergeById(prodProg, shards[c].programs));

        fs.writeFileSync(
            path.join(DRAFTS_DIR, `universities.${c}.draft.json`),
            JSON.stringify(mergedUni, null, 4) + "\n",
        );
        fs.writeFileSync(
            path.join(DRAFTS_DIR, `programs.${c}.draft.json`),
            JSON.stringify(mergedProg, null, 4) + "\n",
        );

        summary.push(
            `${c.toUpperCase()}: ${prodUni.length}→${mergedUni.length} universities, ${prodProg.length}→${mergedProg.length} programs (+${mergedUni.length - prodUni.length} uni, +${mergedProg.length - prodProg.length} prog)`,
        );
    }

    const report = `# Expansion draft ${new Date().toISOString().slice(0, 10)}

${summary.join("\n")}

Total new seeds: ${allSeeds.length} universities, ${newPrograms.length} programs
`;
    fs.writeFileSync(path.join(REPORTS_DIR, `${new Date().toISOString().slice(0, 10)}-expansion.md`), report);

    return { summary, newUniversities: newUniversities.length, newPrograms: newPrograms.length };
}

export function promoteDraftsToProduction(dryRun = false) {
    const results: string[] = [];
    for (const c of ["au", "uk", "ca"] as const) {
        const draftUniPath = path.join(DRAFTS_DIR, `universities.${c}.draft.json`);
        const draftProgPath = path.join(DRAFTS_DIR, `programs.${c}.draft.json`);
        if (!fs.existsSync(draftUniPath) || !fs.existsSync(draftProgPath)) {
            results.push(`${c}: skip (no draft)`);
            continue;
        }
        const universities = validateUniversities(JSON.parse(fs.readFileSync(draftUniPath, "utf-8")));
        const programs = validatePrograms(JSON.parse(fs.readFileSync(draftProgPath, "utf-8")));
        if (!dryRun) {
            fs.writeFileSync(
                path.join(CORE_DATA, `universities.${c}.json`),
                JSON.stringify(universities, null, 4) + "\n",
            );
            fs.writeFileSync(
                path.join(CORE_DATA, `programs.${c}.json`),
                JSON.stringify(programs, null, 4) + "\n",
            );
        }
        results.push(`${c}: promoted ${universities.length} universities, ${programs.length} programs`);
    }
    return results;
}
