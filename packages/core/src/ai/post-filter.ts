// Post-filter for LLM output. Per spec section 8 ("AI 安全与可解释性"), every
// generated fact must trace back to a known source_id. We drop any
// pros/cons entry that references an unknown id, and reject the whole
// narrative if too few pros remain.

import type { RecommendationNarrative } from "./prompts/recommendation-narrative.js";
import { err, ok, type AIError, type Result } from "./result.js";

export function filterNarrative(
    narrative: RecommendationNarrative,
    knownSourceIds: ReadonlySet<string>,
): Result<RecommendationNarrative, AIError> {
    const pros = narrative.pros.filter((p) => knownSourceIds.has(p.source_id));
    const cons = narrative.cons.filter((c) => knownSourceIds.has(c.source_id));

    if (pros.length < 2) {
        return err({
            kind: "post_filter_rejected",
            message: `narrative has only ${pros.length} verifiable pros (min 2)`,
        });
    }

    return ok({ ...narrative, pros, cons });
}
