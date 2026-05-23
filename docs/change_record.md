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

---

<!-- 未来条目追加到上方 v0.0.x 区段，按时间倒序 -->
