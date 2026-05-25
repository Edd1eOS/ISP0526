# ADR-0002: Split Intake Chat into Conversation + Extraction Agents

- **Status**: Accepted
- **Date**: 2026-05-26
- **Decider**: Tech Director (user) + AI co-engineer (Copilot)

## Context

The chat-driven intake (`apps/web/src/features/intake-chat`) was a single LLM
call per turn that did four jobs at once:

1. Decide the next assistant reply (tone, phase, opener).
2. Extract a structured `ClarifyPatch` from the latest user message
   (credentials parsing, enum normalization, Chinese context inference,
   skip detection).
3. Produce `quick_replies` and `input_mode`.
4. Decide the `done` flag for the recommend gate.

The resulting system prompt grew to seventeen rules. Symptoms in
production-ish testing on `gpt-oss-120b`:

- Occasional `??` empty bubbles when the structured object failed schema
  validation, even though the reply text was fine.
- Extraction mistakes (e.g. writing `gaokao` as a top-level patch key)
  leaked into the conversation flow and corrupted accumulated state.
- The prompt was hard to evolve: every conversational tweak risked
  breaking extraction, and every extraction tweak risked breaking tone.

P0 + P1 (slot locking + FSM phase + sessionStorage persistence) addressed
the worst symptoms but did not solve the underlying single-prompt
overload.

## Decision

Split the per-turn LLM work into two sequential, single-responsibility
agents inside `chatIntakeTurnAction`:

```
user reply
   |
   v
[Extraction Agent (EA)] --- input: last assistant question + last user
   |                        message + locked keys + accumulated state
   |                        output schema: { patch?: ClarifyPatch }
   v
sanitizePatch + mergePatchDeep   (existing pure helpers)
   |
   v
[Conversation Agent (CA)] --- input: merged accumulated, missing, locked,
   |                          FSM phase, optional assessment summary
   |                          output schema: { reply, quick_replies?,
   |                          input_mode?, done }
   v
UI response
```

EA runs only when the latest message is from the user. CA always runs.
Failure isolation:

- If EA fails (network, schema), we log a warning and treat the patch as
  empty. CA still produces a reply, so the chat never stalls.
- If CA fails, we fall back to the existing chip-only prompt but still
  return the EA-derived patch so progress is preserved.

The two prompts live in
`apps/web/src/features/intake-chat/chat-prompt-extraction.ts` and
`apps/web/src/features/intake-chat/chat-prompt-conversation.ts`. Shared
constants (`CHAT_PRIORITY`, `MIN_SUPPORTING_SIGNALS`, `FIELD_LABELS_ZH`,
phase / assessment renderers) stay in `chat-prompt.ts`.

The model selection (`getTextModel()`, currently `openai/gpt-oss-120b`
via Groq) is reused for both agents in this iteration. A follow-up may
route EA to a smaller / cheaper model.

## Consequences

Positive:

- Each prompt is focused and ~50% shorter than the previous combined
  prompt. Iterating on tone no longer risks extraction regressions and
  vice versa.
- Extraction errors stop polluting conversation flow. A garbled EA
  output is sanitized to `{}` and the conversation continues.
- Schema-driven testing becomes practical: EA is `(string, string) =>
  ClarifyPatch`; CA is `(state) => reply`. Both can be unit-tested in
  isolation against fixed inputs.
- Streaming the CA output via `streamObject` later is cheap, since CA no
  longer needs to wait for an extraction object to finish.

Negative:

- Two LLM calls per turn instead of one. Wall-clock latency goes up by
  roughly the EA round-trip (~0.5–0.8 s on Groq), and prompt-token cost
  roughly doubles.
- The orchestrator (`chat-actions.ts`) is more complex: it now manages
  two prompts, two schemas, two try/catch blocks, and an order-sensitive
  merge between them.
- Both prompts duplicate the enum lists for `target_level` /
  `target_field` / etc. Drift between the two must be guarded by tests.

## Alternatives Considered

- **Three-agent split with an LLM Router** that picks between
  ask / confirm / summarize / finalize. Rejected: our `nextPhase` finite
  state machine already does this deterministically in code; adding a
  Router LLM would only introduce non-determinism with no gain.
- **Keep the single-agent design and harden the schema.** Rejected:
  schema hardening prevents bad patches but does not stop the
  prompt-rule cross-contamination that hurts conversation quality.
- **Move extraction off the hot path** (run it asynchronously after CA
  responds). Rejected: CA must see the new patch to choose the next
  question; deferring extraction would re-introduce the "asked the same
  thing twice" bug P0 just fixed.

## Follow-ups

- Add focused unit tests for the EA prompt builder against a corpus of
  canonical Chinese intake replies.
- Investigate routing EA to a smaller model (e.g. an 8B variant) to
  halve EA latency.
- After UI stabilizes, evaluate `streamObject` for CA so the user sees
  the next message appear word-by-word.
