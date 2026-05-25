// Weight modulation.
//
// The default `SCORING_WEIGHTS` express our editorial bias. Specific user
// signals can override that bias — e.g. someone who explicitly flags a tight
// budget should have budget weighted more heavily than for the average user.
//
// Every modulation rule is documented inline and is pure: same profile in,
// same weights out. The sum of returned weights is always 1.

import type { StudentProfile } from "../schemas/index";
import { SCORING_WEIGHTS, type ScoringDimension } from "./weights";

export type Weights = Record<ScoringDimension, number>;

export function modulateWeights(profile: StudentProfile): Weights {
    const weights: Weights = { ...SCORING_WEIGHTS };

    // Rule: salary sensitivity at or above 4 on the Likert scale doubles the
    // budget weight; other dimensions are rescaled proportionally.
    const sal = profile.career.salary_sensitivity;
    if (sal !== undefined && sal >= 4) {
        weights.budget = SCORING_WEIGHTS.budget * 2;
    }

    // Rule: migration intent at or above 4 increases the visa_feasibility
    // weight by 50%. People who explicitly want to settle should see visa
    // pathway dominate over reputation polish.
    const mig = profile.career.migration_intent;
    if (mig !== undefined && mig >= 4) {
        weights.visa_feasibility = SCORING_WEIGHTS.visa_feasibility * 1.5;
    }

    return normalize(weights);
}

function normalize(weights: Weights): Weights {
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    if (total === 0) return weights;
    const out = { ...weights };
    for (const key of Object.keys(out) as ScoringDimension[]) {
        out[key] = out[key] / total;
    }
    return out;
}
