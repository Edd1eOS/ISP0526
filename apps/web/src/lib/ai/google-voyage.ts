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

// Best-effort repair of common schema drift in LLM JSON output before
// running Zod validation. Handles: null fields where a typed value is
// expected, scalar values where arrays are expected, oversized arrays,
// empty objects in place of optionals. Anything we can't fix is left
// alone so the schema error still surfaces honestly.
type JsonObj = Record<string, unknown>;

function isObject(v: unknown): v is JsonObj {
    return typeof v === "object" && v !== null && !Array.isArray(v);
}

// Known fields under VoyageProfile (patch) that must be arrays. If the
// model returns a single string, wrap it; if it returns null, drop it.
const PATCH_ARRAY_FIELDS = new Set<string>([
    "notes",
]);

// Recursively drop null values from any object. Zod treats `undefined`
// (missing) as optional, but `null` as a type mismatch for non-nullable
// fields. Models often emit `null` to mean "no value here".
function stripNullsDeep(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value
            .map(stripNullsDeep)
            .filter((v) => v !== undefined && v !== null);
    }
    if (isObject(value)) {
        const out: JsonObj = {};
        for (const [k, v] of Object.entries(value)) {
            if (v === null) continue;
            const cleaned = stripNullsDeep(v);
            if (cleaned !== undefined) out[k] = cleaned;
        }
        return out;
    }
    return value;
}

function sanitizeVoyageTurn(input: unknown): unknown {
    if (!isObject(input)) return input;
    // Strip all `null` recursively first; saves a dozen targeted fixes.
    const obj = stripNullsDeep(input) as JsonObj;

    // question: must be an object with required fields, or absent.
    const q = obj.question;
    if (q !== undefined) {
        if (!isObject(q) || Object.keys(q).length === 0) {
            delete obj.question;
        } else {
            // Truncate oversize options array (schema caps at 6).
            if (Array.isArray(q.options) && q.options.length > 6) {
                q.options = q.options.slice(0, 6);
            }
            // Drop empty options array (schema requires min 2 when present).
            if (Array.isArray(q.options) && q.options.length < 2) {
                delete q.options;
            }
        }
    }

    // patch: must be an object. Coerce string → [string] for known
    // array-typed fields. Drop scalars where objects are expected.
    const patch = obj.patch;
    if (patch !== undefined) {
        if (!isObject(patch)) {
            obj.patch = {};
        } else {
            for (const field of PATCH_ARRAY_FIELDS) {
                const v = patch[field];
                if (typeof v === "string") {
                    patch[field] = [v];
                }
            }
        }
    }

    return obj;
}

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
        parsed = sanitizeVoyageTurn(parsed);
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
