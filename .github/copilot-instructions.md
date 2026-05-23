# Copilot Instructions — ISP0526

These instructions apply to all AI coding assistance in this repository. They are binding for Copilot, Cursor, Claude Code, or any other AI tooling.

The single source of truth is `docs/spec.md`. The red lines are in `docs/prohibition.md`. The workflow is in `docs/workflow.md`. The tech stack is locked in `docs/techstack.md`.

## Hard rules

1. **English only in code and comments.** No Chinese in identifiers, comments, docstrings, commit messages, PR descriptions, or any file under `apps/`, `packages/`, `.github/`. User-facing strings live in i18n message files (`zh.json`, `en.json`).
2. **No emoji anywhere in the repository.** Not in code, not in markdown, not in commits, not in PR descriptions.
3. **Conventional Commits.** `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `perf`, `ci`, `revert`. Lowercase subject, no trailing period.
4. **TypeScript strict mode.** `any` is forbidden without an inline `// reason:` justification.
5. **No new dependency** without justification in the PR description and update to `docs/techstack.md`.
6. **Never invent data.** All institution facts, programs, fees, requirements come from `packages/core/data/*.json`. LLMs translate and rephrase rule outputs; they do not produce facts.
7. **Every recommendation must cite `source_id`.** If a generation cannot be tied to a source, drop it.
8. **All LLM outputs validated by Zod schema** before reaching the UI.
9. **No secrets in code.** Use environment variables; reference via typed config module.
10. **No file deletion via terminal commands** (`Remove-Item`, `rm`, `del`, `rmdir`). If cleanup is needed, tell the user.

## Coding conventions

- Module structure: feature-first under `apps/web/src/features/<feature>/`. Shared logic in `packages/core/`.
- React: function components only; no class components. Server Components by default; mark `'use client'` only when needed.
- State: prefer URL state > React state > Zustand. Avoid global state unless required.
- Data fetching: TanStack Query in client components; direct `await` in Server Components.
- Forms: React Hook Form + Zod resolver. Single Zod schema per form, exported from the feature module.
- Styling: Tailwind utility classes. No CSS modules unless animations require it. Theme tokens via CSS variables.
- Errors: never `catch` without either rethrowing, logging to Sentry, or returning a typed result.
- Tests: colocate `*.test.ts` with source. Rule engine and AI adapter ≥ 80% line coverage.

## AI layer rules

- All LLM calls go through `packages/core/ai/`.
- Prompt templates live as named exports in `packages/core/ai/prompts/`. Never inline a multi-line prompt in business code.
- Every prompt template has a Zod schema for its expected JSON output.
- After receiving an LLM response: parse → validate → post-filter (drop any field with no source citation) → return.
- Streaming responses use the Vercel AI SDK `streamObject` / `streamText` primitives; never custom SSE.

## Rule engine rules

- All scoring logic lives in `packages/core/rules/`.
- Scoring functions are pure: `(profile, candidate) => Score`. No I/O, no LLM calls.
- Each scoring dimension is a separate file with explicit unit tests and a documented weight.
- Weights are exported from a single `weights.ts`; user inputs modulate them via documented functions.

## Workflow reminders

- Before suggesting a multi-file change, read `docs/spec.md` for the affected feature.
- When making a change, append an entry to `docs/change_record.md` in the PR.
- Architectural decisions: add an ADR under `docs/adr/`.

## Self-review checklist (run before proposing a commit)

- [ ] All new strings are English in code, with i18n keys for user-facing text.
- [ ] No emoji introduced.
- [ ] No new dependencies without `techstack.md` update.
- [ ] All LLM outputs pass through a Zod schema.
- [ ] All institution facts trace to `source_id`.
- [ ] `change_record.md` updated.
- [ ] Test coverage holds for engine / AI layer.
