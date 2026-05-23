# 变更记录（Change Record）

> 每个非空 PR 必须在此追加条目。格式：`YYYY-MM-DD | <type>(<scope>) | <subject> | <PR #>`
> 此文件为 Release Notes 的事实源。版本 tag 前抓取相应区间内容。

---

## v0.0.0 — Baseline（仓库初始化）

| 日期 | 类型 | 摘要 | PR |
|---|---|---|---|
| 2026-05-23 | docs(spec) | initial product spec v1.0 | — (pre-repo) |
| 2026-05-23 | chore(repo) | initialize repo skeleton with docs, legal, copilot instructions | — (initial commit) |
| 2026-05-23 | chore(mcp) | add Figma MCP server (Framelink) for design token extraction | — (direct main) |
| 2026-05-23 | docs(spec) | section 7 rewritten as Warm Claymorphism design system with full token table (colors / radii / shadows / typography) extracted from Meng To reference + warm palette adaptation | — (direct main) |
| 2026-05-23 | feat(scaffold) | sprint 0: scaffold `apps/web` (Next.js 16 + TS strict + Tailwind v4) and `packages/core` (rules/ai/data/schemas); write warm claymorphism tokens into `globals.css`; add token-preview landing page; add i18n message files (zh/en); add Supabase env helper + `.env.example`; add GitHub Actions CI (lint+typecheck+test+build) | feat/scaffold-web-and-core |
| 2026-05-23 | refactor(spec) | business model adjusted: users no longer routed to commercial agents directly. Reports now end in a low-key "want to talk to someone?" card that opens a Contact page (WhatsApp / WeChat to our team + report ID). Agents remain a backend referral channel, invisible to end users. Renamed `TransferCode` -> `ReportCode`, updated FR-5.3 / FR-6 / FR-9.3 / NFR-5.5 / data model / KPIs / risks accordingly. i18n message files updated. | feat/scaffold-web-and-core |
| 2026-05-23 | docs | sync spec 7.2.1 color/shadow tables with desaturated palette (round 2); update techstack.md to Next 16 / TS 5.9 / Node 22 / pnpm 11.2.2 and document `allowBuilds` constraint | feat/scaffold-web-and-core |
| 2026-05-23 | feat(core) | sprint 1 step 1: introduce Zod schemas (`ids`, `source`, `institution`, `student-profile`, `scoring`) as the single source of truth for the rule engine and the LLM contract; add 5 Go8 placeholder rows in `packages/core/data/{universities,programs}.au.json` with `source_id` citations; wire static data loader that validates JSON at module init; implement `thresholds.applyHardThresholds`, `bands.classifyBand`, and the first scoring dimension `academic-fit` with 7 unit tests; wire vitest, allow esbuild postinstall in `pnpm-workspace.yaml` | feat/scaffold-web-and-core |
| 2026-05-23 | feat(core) | sprint 1 step 2: complete 7-dimension scoring engine — add `personality`, `lifestyle`, `career`, `budget`, `tag_boost`, `reputation` pure scoring functions with shared `__fixtures__` and 26 colocated tests; add weight personalization (`modulate.ts`, doubles budget weight on high salary sensitivity); add aggregator `score.scoreCandidate` that combines the 7 dimensions into a validated `Score` (per-dimension breakdown, 0..100 final score, band, cited reasons); add `recommend.recommend` pipeline (hard thresholds -> score -> sort -> bucket caps 5/10/5); 41 tests green | feat/scaffold-web-and-core |
| 2026-05-23 | feat(core) | sprint 1 step 3: AI adapter scaffold — add `ai/result.ts` Result type with `AIError`; `ai/config.ts` env-driven `getModel(role)`; `ai/prompts/recommendation-narrative.ts` (Zod schema + system prompt + structured user-prompt builder, bilingual zh/en); `ai/post-filter.ts` rejecting narratives whose citations are not in the known source-id set; `ai/adapters/narrative.ts` injectable `GenerateObjectFn` so the Vercel AI SDK can be wired without coupling business code. 53 tests green; no new runtime dependencies | feat/scaffold-web-and-core |

---

<!-- 未来条目追加到上方 v0.0.x 区段，按时间倒序 -->
