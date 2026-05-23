// Static data loader.
//
// Phase 1 ships universities and programs as JSON in `packages/core/data/`.
// Each load is validated against the Zod schemas at module init time so a
// malformed row fails the build, never a runtime user request.

import {
    CandidateSchema,
    ProgramSchema,
    UniversitySchema,
    type Candidate,
    type Program,
    type University,
    type UniversityId,
} from "../schemas/index.js";
import universitiesAuRaw from "../../data/universities.au.json" with { type: "json" };
import programsAuRaw from "../../data/programs.au.json" with { type: "json" };

const universitiesAu: readonly University[] = Object.freeze(
    UniversitySchema.array().parse(universitiesAuRaw),
);

const programsAu: readonly Program[] = Object.freeze(
    ProgramSchema.array().parse(programsAuRaw),
);

const universityById: ReadonlyMap<UniversityId, University> = new Map(
    universitiesAu.map((u) => [u.id, u] as const),
);

export function getUniversities(): readonly University[] {
    return universitiesAu;
}

export function getPrograms(): readonly Program[] {
    return programsAu;
}

export function getCandidates(): readonly Candidate[] {
    const candidates: Candidate[] = [];
    for (const program of programsAu) {
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

