// Map a candidate's academic_fit score (0..1) to one of three display bands.
//
// The thresholds reflect intent, not statistics:
//   stretch: aspirational; user is reaching above their on-paper level
//   match:   user is comfortably within range
//   safety:  user clearly exceeds the bar
//
// Thresholds come from `weights.ts` so reweighting in one place is honored.

import type { BandTier } from "../schemas/index.js";
import { BAND_THRESHOLDS } from "./weights.js";

export function classifyBand(academicFit: number): BandTier {
    if (academicFit < BAND_THRESHOLDS.stretch_max) return "stretch";
    if (academicFit < BAND_THRESHOLDS.match_max) return "match";
    return "safety";
}
