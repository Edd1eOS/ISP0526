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
import visaRoutesRaw from "../../data/visa-routes.json" with { type: "json" };

const universities: readonly University[] = Object.freeze(
    UniversitySchema.array().parse([
        ...universitiesAuRaw,
        ...universitiesUkRaw,
        ...universitiesCaRaw,
    ]),
);

const programs: readonly Program[] = Object.freeze(
    ProgramSchema.array().parse([
        ...programsAuRaw,
        ...programsUkRaw,
        ...programsCaRaw,
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

