// Vercel AI SDK closure that backs core's GenerateObjectFn interface for
// the voyage detail-refinement prompt. Binds VoyageTurnSchema at call
// time; core re-validates afterwards for defense in depth.
//
// We deliberately do NOT use ai-sdk's Output.object here: that path
// forces a hard schema validation inside the SDK and throws
// NoObjectGeneratedError on any drift (extra field, wrong enum, etc.),
// which surfaces as a fatal error to the user even when the response
// is mostly usable. Instead we ask the model for raw JSON text, parse
// it ourselves, attempt simple repairs, and validate with our own
// (more tolerant) Zod schema. The provider fallback in
// runTextWithFallback still kicks in on retryable errors.

import "server-only";
import { generateText } from "ai";
import { VoyageTurnSchema, type GenerateObjectFn } from "@isp0526/core";
import { runTextWithFallback } from "./google-narrative";

// Extract the first balanced {...} block from a free-form string.
// Handles common LLM verbosity: ```json fences, leading prose, trailing
// commentary. Returns the raw substring (still unparsed) or null.
function extractJsonObject(text: string): string | null {
    if (!text) return null;
    // Strip markdown fences if present.
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const body = fenced?.[1] ?? text;
    const start = body.indexOf("{");
    if (start < 0) return null;
    let depth = 0;
    let inStr = false;
    let escape = false;
    for (let i = start; i < body.length; i += 1) {
        const ch = body[i];
        if (escape) {
            escape = false;
            continue;
        }
        if (ch === "\\") {
            escape = true;
            continue;
        }
        if (ch === '"') {
            inStr = !inStr;
            continue;
        }
        if (inStr) continue;
        if (ch === "{") depth += 1;
        else if (ch === "}") {
            depth -= 1;
            if (depth === 0) return body.slice(start, i + 1);
        }
    }
    return null;
}

export function buildGoogleVoyageGenerator(): GenerateObjectFn {
    return async ({ system, prompt }) => {
        const jsonOnlyHint =
            "\n\nRespond with a single JSON object ONLY (no markdown fences, no commentary). The JSON must conform to VoyageTurnSchema as described above.";
        const fullPrompt = `${prompt}${jsonOnlyHint}`;
        const { text } = await runTextWithFallback((model) =>
            generateText({
                model,
                system,
                prompt: fullPrompt,
            }),
        );
        const raw = extractJsonObject(text);
        if (!raw) {
            throw new Error(
                "voyage: model did not return a JSON object (no {...} block found in response).",
            );
        }
        let parsed: any;
        try {
            parsed = JSON.parse(raw);
        } catch (cause) {
            throw new Error(
                `voyage: model JSON failed to parse: ${cause instanceof Error ? cause.message : String(cause)}`,
            );
        }
        // --- AUTO-FIX: 修正常见 LLM schema 错误 ---
        // 1. question: null/{} → undefined
        if (parsed && typeof parsed.question === "object" && parsed.question && Object.keys(parsed.question).length === 0) {
            parsed.question = undefined;
        }
        if (parsed && parsed.question === null) {
            parsed.question = undefined;
        }
        // 2. patch.stage.current_education: null → "other"
        if (parsed && parsed.patch && parsed.patch.stage && parsed.patch.stage.current_education == null) {
            parsed.patch.stage.current_education = "other";
        }
        // 3. patch.stage: null → undefined
        if (parsed && parsed.patch && parsed.patch.stage === null) {
            delete parsed.patch.stage;
        }
        // 4. patch: null → {}
        if (parsed && parsed.patch === null) {
            parsed.patch = {};
        }
        // 5. question.topic: null → "other"
        if (parsed && parsed.question && parsed.question.topic == null) {
            parsed.question.topic = "other";
        }
        // 6. question.kind: null → "free"
        if (parsed && parsed.question && parsed.question.kind == null) {
            parsed.question.kind = "free";
        }
        // 7. question.prompt: null → "Please clarify."
        if (parsed && parsed.question && parsed.question.prompt == null) {
            parsed.question.prompt = "Please clarify.";
        }
        // 8. question.options: null → undefined
        if (parsed && parsed.question && parsed.question.options == null) {
            delete parsed.question.options;
        }
        // 9. question.placeholder: null → undefined
        if (parsed && parsed.question && parsed.question.placeholder == null) {
            delete parsed.question.placeholder;
        }
        // 10. question.landmark: null → undefined
        if (parsed && parsed.question && parsed.question.landmark == null) {
            delete parsed.question.landmark;
        }
        // 11. patch.*: null → undefined (shallow)
        if (parsed && parsed.patch && typeof parsed.patch === "object") {
            for (const k of Object.keys(parsed.patch)) {
                if (parsed.patch[k] === null) parsed.patch[k] = undefined;
            }
        }
        // --- END AUTO-FIX ---
        const result = VoyageTurnSchema.safeParse(parsed);
        if (!result.success) {
            // Surface the first validation issue so the upstream retry
            // wrapper can decide whether to fall back / try again.
            const issue = result.error.issues[0];
            const path = issue?.path?.join(".") ?? "(root)";
            throw new Error(
                `voyage: response did not match schema at ${path}: ${issue?.message ?? "unknown"}`,
            );
        }
        // Half-baked turn: model said the conversation is not done but
        // didn't supply a question. Treat as a retryable schema-drift
        // failure so runTextWithFallback can try again / fall back to
        // the next provider before we resort to the synthesized
        // fallback in the core adapter.
        if (!result.data.done && !result.data.question) {
            throw new Error(
                "voyage: response did not match schema at question: Required when done=false",
            );
        }
        return { object: result.data };
    };
}
