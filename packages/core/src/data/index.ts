// Static data loader.
//
// Phase 1 ships universities and programs as JSON in `packages/core/data/`,
// sharded by country (universities.<cc>.json + programs.<cc>.json). All
// shards are merged at module init and validated against the Zod schemas
// so a malformed row fails the build, never a runtime user request.

import {
    CandidateSchema,
    ProgramSchema,
    UniversitySchema,
    VisaRouteMapSchema,
    type Candidate,
    type Program,
    type University,
    type UniversityId,
    type VisaRouteMap,
} from "../schemas/index";
import universitiesAuRaw from "../../data/universities.au.json" with { type: "json" };
import programsAuRaw from "../../data/programs.au.json" with { type: "json" };
import universitiesUkRaw from "../../data/universities.uk.json" with { type: "json" };
import programsUkRaw from "../../data/programs.uk.json" with { type: "json" };
import universitiesCaRaw from "../../data/universities.ca.json" with { type: "json" };
import programsCaRaw from "../../data/programs.ca.json" with { type: "json" };
import universitiesDeRaw from "../../data/universities.de.json" with { type: "json" };
import programsDeRaw from "../../data/programs.de.json" with { type: "json" };
import universitiesHkRaw from "../../data/universities.hk.json" with { type: "json" };
import programsHkRaw from "../../data/programs.hk.json" with { type: "json" };
import universitiesIeRaw from "../../data/universities.ie.json" with { type: "json" };
import programsIeRaw from "../../data/programs.ie.json" with { type: "json" };
import universitiesMoRaw from "../../data/universities.mo.json" with { type: "json" };
import programsMoRaw from "../../data/programs.mo.json" with { type: "json" };
import universitiesMyRaw from "../../data/universities.my.json" with { type: "json" };
import programsMyRaw from "../../data/programs.my.json" with { type: "json" };
import universitiesNlRaw from "../../data/universities.nl.json" with { type: "json" };
import programsNlRaw from "../../data/programs.nl.json" with { type: "json" };
import universitiesNzRaw from "../../data/universities.nz.json" with { type: "json" };
import programsNzRaw from "../../data/programs.nz.json" with { type: "json" };
import universitiesRuRaw from "../../data/universities.ru.json" with { type: "json" };
import programsRuRaw from "../../data/programs.ru.json" with { type: "json" };
import universitiesSgRaw from "../../data/universities.sg.json" with { type: "json" };
import programsSgRaw from "../../data/programs.sg.json" with { type: "json" };
import universitiesThRaw from "../../data/universities.th.json" with { type: "json" };
import programsThRaw from "../../data/programs.th.json" with { type: "json" };
import universitiesTwRaw from "../../data/universities.tw.json" with { type: "json" };
import programsTwRaw from "../../data/programs.tw.json" with { type: "json" };
import universitiesUsRaw from "../../data/universities.us.json" with { type: "json" };
import programsUsRaw from "../../data/programs.us.json" with { type: "json" };
import visaRoutesRaw from "../../data/visa-routes.json" with { type: "json" };

const universities: readonly University[] = Object.freeze(
    UniversitySchema.array().parse([
        ...universitiesAuRaw,
        ...universitiesUkRaw,
        ...universitiesCaRaw,
        ...universitiesUsRaw,
        ...universitiesNzRaw,
        ...universitiesHkRaw,
        ...universitiesSgRaw,
        ...universitiesMyRaw,
        ...universitiesThRaw,
        ...universitiesDeRaw,
        ...universitiesNlRaw,
        ...universitiesIeRaw,
        ...universitiesRuRaw,
        ...universitiesTwRaw,
        ...universitiesMoRaw,
    ]),
);

const programs: readonly Program[] = Object.freeze(
    ProgramSchema.array().parse([
        ...programsAuRaw,
        ...programsUkRaw,
        ...programsCaRaw,
        ...programsUsRaw,
        ...programsNzRaw,
        ...programsHkRaw,
        ...programsSgRaw,
        ...programsMyRaw,
        ...programsThRaw,
        ...programsDeRaw,
        ...programsNlRaw,
        ...programsIeRaw,
        ...programsRuRaw,
        ...programsTwRaw,
        ...programsMoRaw,
    ]),
);

const universityById: ReadonlyMap<UniversityId, University> = new Map(
    universities.map((u) => [u.id, u] as const),
);

const visaRoutes: VisaRouteMap = Object.freeze(
    VisaRouteMapSchema.parse(visaRoutesRaw),
);

export function getVisaRoutes(): VisaRouteMap {
    return visaRoutes;
}

export function getUniversities(): readonly University[] {
    return universities;
}

export function getPrograms(): readonly Program[] {
    return programs;
}

export function getCandidates(): readonly Candidate[] {
    const candidates: Candidate[] = [];
    for (const program of programs) {
        const university = universityById.get(program.university_id);
        if (!university) {
            // A program pointing at an unknown university is a data-integrity bug
            // and must fail loud at module init.
            throw new Error(
                `program ${program.id} references unknown university ${program.university_id}`,
            );
        }
        candidates.push(CandidateSchema.parse({ program, university }));
    }
    return Object.freeze(candidates);
}

