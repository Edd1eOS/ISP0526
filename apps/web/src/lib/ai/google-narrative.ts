// Vercel AI SDK closure that backs core's GenerateObjectFn interface. The
// provider is selected at runtime: Groq when GROQ_API_KEY is set (preferred
// due to higher free-tier limits and better stability than Gemini's 20
// req/day free tier), otherwise Google Gemini. Lives in the web app rather
// than core so core stays SDK-agnostic.

import "server-only";
import { generateText, Output } from "ai";
import type { LanguageModel } from "ai";
import { google } from "@ai-sdk/google";
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

export function isLLMConfigured(): boolean {
    return Boolean(
        process.env.GROQ_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    );
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
    logProviderOnce("google", GOOGLE_MODEL_ID);
    return google(GOOGLE_MODEL_ID);
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

