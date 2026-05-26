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
        let parsed: unknown;
        try {
            parsed = JSON.parse(raw);
        } catch (cause) {
            throw new Error(
                `voyage: model JSON failed to parse: ${cause instanceof Error ? cause.message : String(cause)}`,
            );
        }
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
        return { object: result.data };
    };
}
