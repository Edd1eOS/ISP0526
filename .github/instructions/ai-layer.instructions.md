---
applyTo: "packages/core/ai/**"
---

# AI layer conventions

- Every LLM call is wrapped in an adapter under `packages/core/ai/adapters/`.
- Adapter signature: `(input: TInput) => Promise<Result<TOutput, AIError>>` where `TOutput` is validated by Zod.
- Prompts are named exports from `packages/core/ai/prompts/<feature>.ts`. The exported value is `{ system, user, schema }`.
- The Zod schema is the ONLY trusted parser for LLM output. No regex-based extraction.
- After Zod parse, run a post-filter to drop any item whose `source_id` is missing or not found in the local data catalog.
- Log every LLM request/response (input, output, model, latency, tokens) to the AI audit table. No PII beyond what the user explicitly submitted.
- Streaming: use Vercel AI SDK `streamObject` with the Zod schema. No raw fetch SSE handling.
- Model selection is config-driven via `packages/core/ai/config.ts`. Business code calls `getModel('extraction')`, not `openai('gpt-4o-mini')`.
- Cost: track token usage per request; surface to admin dashboard.
- Never feed raw user free-text into a prompt without first extracting structured fields via a separate extraction call.
- Refuse silently: if validation fails twice, return `Err(ValidationError)` and let the caller display a graceful fallback. Do not retry indefinitely.
