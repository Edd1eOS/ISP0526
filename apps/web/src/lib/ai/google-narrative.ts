// Vercel AI SDK closure that backs core's GenerateObjectFn interface. The
// provider is selected at runtime: Groq when GROQ_API_KEY is set (preferred
// due to higher free-tier limits and better stability than Gemini's 20
// req/day free tier), otherwise Google Gemini. Lives in the web app rather
// than core so core stays SDK-agnostic.

import "server-only";
import { generateText, Output } from "ai";
import type { LanguageModel } from "ai";
import { google, createGoogleGenerativeAI } from "@ai-sdk/google";
import { groq } from "@ai-sdk/groq";
import {
    BatchNarrativeSchema,
    type GenerateObjectFn,
} from "@isp0526/core";

const GOOGLE_MODEL_ID =
    process.env.GOOGLE_TEXT_MODEL_ID || "gemini-2.5-flash";
// Default model must support response_format: json_schema. See
// https://console.groq.com/docs/structured-outputs#supported-models
// gpt-oss-120b: better Chinese instruction following than 20b, still cheap.
const GROQ_MODEL_ID =
    process.env.GROQ_MODEL_ID || "openai/gpt-oss-120b";

// Resolve a Gemini API key from any of the supported env names without
// reading the .env file directly. The fallback name FALLBACK_TO_GEMINI_KEY
// is the project-specific convention for the backup Gemini credential.
function getGeminiApiKey(): string | undefined {
    return (
        process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
        process.env.FALLBACK_TO_GEMINI_KEY ||
        process.env.GEMINI_API_KEY
    );
}

// Build the Gemini language model with whichever key is available.
// When GOOGLE_GENERATIVE_AI_API_KEY is set, the default google() factory
// picks it up automatically; otherwise we pass the key explicitly via
// createGoogleGenerativeAI so FALLBACK_TO_GEMINI_KEY also works.
function buildGeminiModel(): LanguageModel | null {
    const key = getGeminiApiKey();
    if (!key) return null;
    if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
        return google(GOOGLE_MODEL_ID);
    }
    const provider = createGoogleGenerativeAI({ apiKey: key });
    return provider(GOOGLE_MODEL_ID);
}

export function isLLMConfigured(): boolean {
    return Boolean(process.env.GROQ_API_KEY || getGeminiApiKey());
}

// Backward-compatible alias. Some callers still import this name; both
// resolve to the same provider-agnostic check.
// reason: avoid churning 7 call sites in a hot-fix PR
export const isGoogleConfigured = isLLMConfigured;

// Returns the active text model for structured generation. Groq takes
// precedence when configured; otherwise we fall back to Gemini for local
// dev parity with prior setup. Logs the choice once per process so the
// dev console clearly shows which provider is in use.
let providerLogged = false;
function logProviderOnce(provider: "groq" | "google", modelId: string): void {
    if (providerLogged) return;
    providerLogged = true;
    // eslint-disable-next-line no-console
    console.info(`[ai] text model provider: ${provider} (${modelId})`);
}

export function getTextModel(): LanguageModel {
    if (process.env.GROQ_API_KEY) {
        logProviderOnce("groq", GROQ_MODEL_ID);
        return groq(GROQ_MODEL_ID);
    }
    const gemini = buildGeminiModel();
    if (!gemini) {
        throw new Error(
            "No LLM provider configured (set GROQ_API_KEY or FALLBACK_TO_GEMINI_KEY / GOOGLE_GENERATIVE_AI_API_KEY).",
        );
    }
    logProviderOnce("google", GOOGLE_MODEL_ID);
    return gemini;
}

// Returns an ordered list of candidate models for per-request fallback.
// Groq is preferred when configured, but its free-tier daily token cap
// (200K TPD) is small and easy to exhaust during a single voyage session
// (~20-40 turns x ~8K tokens). When Groq returns 429 / quota / overload
// errors and Gemini is also configured, callers SHOULD retry with the
// next candidate. See runTextWithFallback below.
export function getTextModelCandidates(): ReadonlyArray<{
    readonly provider: "groq" | "google";
    readonly model: LanguageModel;
    readonly modelId: string;
}> {
    const list: Array<{
        readonly provider: "groq" | "google";
        readonly model: LanguageModel;
        readonly modelId: string;
    }> = [];
    if (process.env.GROQ_API_KEY) {
        list.push({
            provider: "groq",
            model: groq(GROQ_MODEL_ID),
            modelId: GROQ_MODEL_ID,
        });
    }
    const gemini = buildGeminiModel();
    if (gemini) {
        list.push({
            provider: "google",
            model: gemini,
            modelId: GOOGLE_MODEL_ID,
        });
    }
    return list;
}

// Heuristic: should we try the next provider when this error fires?
// - Quota / rate-limit / overload: definitely.
// - Schema-validation / "No object generated" failures from the AI SDK
//   (small open-weight models like gpt-oss-120b sometimes emit JSON that
//   doesn't fit the bound schema): yes, give the bigger frontier model a
//   shot before failing the whole turn.
// - Hard auth / config errors: NO, re-throw so the caller surfaces them.
function isRetryableError(err: unknown): boolean {
    const msg =
        err instanceof Error
            ? err.message
            : typeof err === "string"
                ? err
                : "";
    if (
        /\b(rate.?limit|quota|429|TPD|RPD|tokens? per (day|minute)|over.?capacity|overloaded|try again)\b/i.test(
            msg,
        )
    ) {
        return true;
    }
    if (
        /(no object generated|did not match schema|invalid json|response did not match|tool call validation|aitypevalidationerror)/i.test(
            msg,
        )
    ) {
        return true;
    }
    return false;
}

// Run a generate-text call against each configured provider in order.
// Falls back to the next provider only on quota / rate-limit / overload
// errors. The caller passes a closure because Output.object needs the
// schema bound at call time.
export async function runTextWithFallback<T>(
    run: (model: LanguageModel) => Promise<T>,
): Promise<T> {
    const candidates = getTextModelCandidates();
    if (candidates.length === 0) {
        throw new Error("No LLM provider configured.");
    }
    let lastErr: unknown;
    for (let i = 0; i < candidates.length; i += 1) {
        const cand = candidates[i];
        if (!cand) continue;
        try {
            return await run(cand.model);
        } catch (err) {
            lastErr = err;
            const isLast = i === candidates.length - 1;
            if (isLast || !isRetryableError(err)) throw err;
            // eslint-disable-next-line no-console
            console.warn(
                `[ai] provider ${cand.provider} (${cand.modelId}) failed retryably; falling back to next provider. cause: ${err instanceof Error ? err.message : String(err)}`,
            );
        }
    }
    // Unreachable: the loop always either returns or throws, but TS
    // doesn't know that.
    throw lastErr instanceof Error
        ? lastErr
        : new Error("All LLM providers failed.");
}

// Returns a generate function bound to the batch schema. We bind the schema
// here rather than in the core adapter because Vercel AI SDK's Output.object
// requires the schema at call time (it shapes the model's JSON output via
// tool calling). The core adapter re-validates with Zod after the call so
// this stays defense-in-depth.
export function buildGoogleBatchGenerator(): GenerateObjectFn {
    return async ({ system, prompt }) => {
        const { output } = await generateText({
            model: getTextModel(),
            output: Output.object({ schema: BatchNarrativeSchema }),
            system,
            prompt,
        });
        return { object: output };
    };
}

