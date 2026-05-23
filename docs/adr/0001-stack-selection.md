# ADR-0001: Tech Stack Selection for Phase 1

- **Status**: Accepted
- **Date**: 2026-05-23
- **Decider**: Tech Director (user) + AI co-engineer (Copilot)

## Context

Phase 1 is a zero-cost AI school recommendation web app for Chinese students applying abroad, deployable to a platform subdomain (e.g. Vercel). Phase 2 will pivot to a React Native mobile app with gamification. The team is 2-3 people in Sydney.

Constraints:
- Bilingual (ZH/EN) with warm-color UX (rules out Streamlit's defaults).
- Must migrate UI logic to React Native in Phase 2 (rules out Python frontends).
- Zero infra cost in Phase 1 (rules out paid managed services beyond free tiers).
- Compliance: China PIPL + Australian Privacy Act 1988 (skip GDPR for now).
- Anti-hallucination is non-negotiable for AI outputs.

## Decision

Adopt the stack documented in `docs/techstack.md`:
- Next.js 15 (App Router) + React 19 + TypeScript strict
- Tailwind v4 + shadcn/ui + Framer Motion
- next-intl, Zustand, TanStack Query, RHF + Zod
- Supabase (Sydney region) for DB / Auth / Storage / RLS
- Vercel Hobby for hosting
- Vercel AI SDK as the model adapter; rule-engine-driven scoring (LLM only translates rule outputs)
- pnpm monorepo: `apps/web` + `packages/core`
- PostHog Cloud + Sentry for observability
- Vitest + Playwright for tests
- Big Five (TIPI) for personality (MBTI is trademarked)

## Consequences

Positive:
- React → React Native migration path preserved.
- Free-tier deployment achievable.
- Type safety + RLS reduce AI / data leakage risk.
- shadcn copy-in model avoids long-tail dependency risk.

Negative / trade-offs:
- Next.js 15 + React 19 are recent; library ecosystem occasionally lags.
- Supabase vendor lock-in (mitigated by Postgres being portable).
- No custom domain in Phase 1 limits brand polish.

## Alternatives Considered

- Streamlit: rejected (UI customization weak; no path to React Native).
- Lovable / v0: rejected (generated code uncontrollable for long-term maintenance).
- Prisma ORM: rejected (Supabase type-gen already sufficient; one less layer).
- MBTI personality model: rejected (trademark + weaker scientific consensus vs Big Five).
- WeChat login: rejected (China qualification / ICP filing overhead).
