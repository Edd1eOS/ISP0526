---
applyTo: "packages/core/rules/**"
---

# Rule engine conventions

- Every scoring function is pure: `(profile: Profile, candidate: Candidate) => DimensionScore`.
- No I/O, no LLM calls, no `Date.now()`, no `Math.random()`. Determinism is mandatory.
- One file per dimension under `packages/core/rules/dimensions/`. File name = dimension name (`academic-fit.ts`, `personality.ts`, etc.).
- Each dimension exports:
  - `score(profile, candidate): number` returning a normalized value in `[0, 1]`.
  - `explain(profile, candidate): string[]` returning bullet reasons in English (i18n happens in the UI layer).
  - `defaultWeight: number` from `weights.ts`.
- Weights are aggregated in `packages/core/rules/weights.ts`. Sum must equal 1.0 (unit test asserts this).
- User-input weight modulation lives in `packages/core/rules/modulate.ts` with documented mapping functions.
- Hard thresholds (e.g. GPA × 0.85 tolerance) live in `packages/core/rules/thresholds.ts`. Exclusions are recorded with a reason, not silently dropped.
- Output band classification (Stretch / Match / Safety) lives in `packages/core/rules/bands.ts`.
- Every dimension has `*.test.ts` colocated. Coverage ≥ 80% on all files in `packages/core/rules/`.
- The rule engine NEVER calls into the AI layer. Data flows one direction: rules → AI (for translation only).
