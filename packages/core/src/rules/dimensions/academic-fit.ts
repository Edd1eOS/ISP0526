// Academic fit dimension.
//
// Score is driven primarily by how far above the program's GPA floor the
// applicant sits, with a smaller contribution from language requirement
// headroom. Missing inputs degrade to a neutral 0.5 ("no signal") rather than
// to 0, so an unknown does not punish a candidate.

import type { Candidate, StudentProfile } from "../../schemas/index.js";
import { SCORING_WEIGHTS } from "../weights.js";

export const defaultWeight = SCORING_WEIGHTS.academic_fit;

const NEUTRAL = 0.5;

// Maps GPA delta vs program min onto a 0..1 curve.
// delta = -0.4  -> 0.0   (well below floor)
// delta =  0.0  -> 0.6   (exactly at floor: passing but unimpressive)
// delta = +0.7  -> 1.0   (comfortably above)
function gpaFitCurve(delta: number): number {
  const min = -0.4;
  const max = 0.7;
  const clamped = Math.max(min, Math.min(max, delta));
  // Linear interpolation across the band; piecewise pivot at 0.0 -> 0.6.
  if (clamped <= 0) {
    const t = (clamped - min) / (0 - min); // 0..1 across [-0.4, 0]
    return t * 0.6;
  }
  const t = clamped / max; // 0..1 across [0, 0.7]
  return 0.6 + t * 0.4;
}

function ieltsHeadroom(profile: StudentProfile, candidate: Candidate): number {
  const required = candidate.program.language_min.ielts_overall;
  const observed = profile.academic.ielts_overall;
  if (required === undefined || observed === undefined) return NEUTRAL;
  const diff = observed - required;
  if (diff <= -1) return 0;
  if (diff >= 1.5) return 1;
  return (diff + 1) / 2.5;
}

export function score(profile: StudentProfile, candidate: Candidate): number {
  const { gpa } = profile.academic;
  const gpaPart =
    gpa === undefined ? NEUTRAL : gpaFitCurve(gpa - candidate.program.gpa_min);
  const langPart = ieltsHeadroom(profile, candidate);
  // GPA dominates academic fit (0.75) with language as a smaller modulator.
  return clamp01(gpaPart * 0.75 + langPart * 0.25);
}

export function explain(
  profile: StudentProfile,
  candidate: Candidate,
): string[] {
  const reasons: string[] = [];
  const { gpa, ielts_overall } = profile.academic;
  const { program } = candidate;

  if (gpa !== undefined) {
    const delta = gpa - program.gpa_min;
    if (delta >= 0.5) {
      reasons.push(
        `Your GPA (${gpa.toFixed(2)}) is comfortably above the program minimum of ${program.gpa_min.toFixed(2)}.`,
      );
    } else if (delta >= 0) {
      reasons.push(
        `Your GPA (${gpa.toFixed(2)}) meets the program minimum (${program.gpa_min.toFixed(2)}) with limited headroom.`,
      );
    } else {
      reasons.push(
        `Your GPA (${gpa.toFixed(2)}) is below the listed minimum (${program.gpa_min.toFixed(2)}); admission would be aspirational.`,
      );
    }
  } else {
    reasons.push(
      "GPA not provided; academic fit estimated as a neutral baseline.",
    );
  }

  const ieltsRequired = program.language_min.ielts_overall;
  if (ieltsRequired !== undefined && ielts_overall !== undefined) {
    const headroom = ielts_overall - ieltsRequired;
    if (headroom >= 0) {
      reasons.push(
        `IELTS overall ${ielts_overall.toFixed(1)} meets the program's ${ieltsRequired.toFixed(1)} requirement.`,
      );
    } else {
      reasons.push(
        `IELTS overall ${ielts_overall.toFixed(1)} is below the program's ${ieltsRequired.toFixed(1)} requirement.`,
      );
    }
  }

  return reasons;
}

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}
