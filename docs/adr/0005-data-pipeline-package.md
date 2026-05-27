# ADR 0005: Introduce `packages/data-pipeline` for institution data ingest

- Status: Proposed
- Date: 2026-05-27

## Context

`packages/core/data/*.json` currently holds 11 universities and 75 programs
across AU/UK/CA, far short of the spec FR-3.1 / FR-3.2 GA target (>= 200
universities, >= 500 programs). There is no ingestion code in the repo: all
rows have been hand-written. As the dataset scales we need a repeatable way
to fetch, normalize, validate, and stage candidate rows without ever letting
unverified data reach the runtime loader.

The hard project rules still apply: never invent data; every fact cites a
`source_id`; all data is Zod-validated; no new dependency without a tech
stack update; production loader must stay deterministic and offline.

## Decision

Create a new pnpm workspace `packages/data-pipeline` whose only job is to
turn public sources into draft JSON that humans can review and promote into
`packages/core/data/`. The pipeline is fully described in
`docs/data-pipeline.md` and `docs/data-pipeline-sources.md`. Key properties:

1. The pipeline is a separate workspace. `@isp0526/core` does not depend on
   it; the runtime never imports it.
2. The pipeline depends on `@isp0526/core` for Zod schemas, so the contract
   stays single-sourced in `packages/core/src/schemas/`.
3. Pipeline output lives in `packages/data-pipeline/drafts/`. The core
   loader in `packages/core/src/data/index.ts` does not import this path.
4. Promotion from draft to production is a human-run CLI command
   (`pnpm pipeline promote <id>`) that edits `packages/core/data/*.json`
   and is committed by a person, not by CI.
5. Allowed runtime dependencies for the pipeline: `undici` (HTTP),
   `linkedom` or `cheerio` (HTML parsing), `robots-parser`. No headless
   browser. No LLM SDK in this workspace.
6. All fetched pages are stored as fixtures under
   `packages/data-pipeline/fixtures/`. CI parser tests read only fixtures;
   they do not hit the network.

## Consequences

- Adds one workspace, three production deps (`undici`, `linkedom` or
  `cheerio`, `robots-parser`) and dev tooling reuse from the root.
  `docs/techstack.md` gains a "Data pipeline" section recording these.
- Splits the "is this fact true" responsibility cleanly: the schema in
  `core` is the contract, the pipeline is one producer, hand edits remain a
  legitimate second producer, the loader is the consumer.
- Establishes drafts as a first-class artifact in the repo, separate from
  production. Reviewers see exactly what changed when a row is promoted.
- Keeps the runtime bundle size unchanged: the pipeline is dev-only and not
  imported by `apps/web`.
- Trade-off: contributors now have one more workspace to learn. Mitigated
  by `docs/data-pipeline.md` §9 step-by-step handoff and by keeping the CLI
  surface small (7 commands, see §6).

## Alternatives considered

- **Add scripts under a top-level `scripts/` folder.** Rejected: scripts
  would still need to import core schemas, which works, but they would not
  have their own `package.json`, lockfile entry, or test boundary. Hard to
  isolate dependencies, hard to ban LLM SDKs from this layer by convention
  alone.
- **Inline an ingest module inside `packages/core`.** Rejected: would bring
  HTTP / HTML deps into the runtime package and risk core accidentally
  importing pipeline code paths.
- **Use a SaaS scraper (Apify, Bright Data, etc.).** Rejected: external
  data plane, opaque cost, opaque ToS posture, contradicts the "public
  data + human curate" promise in spec FR-3.4.
- **Skip a pipeline entirely and keep hand-writing JSON.** Rejected: does
  not scale to >= 200 universities and gives no replay / freshness story
  for FR-3.5 quarterly review.
