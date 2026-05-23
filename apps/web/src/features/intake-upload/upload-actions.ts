"use server";

import { extractProfileFromText, type ExtractedProfile } from "@isp0526/core";
import {
    isGoogleConfigured,
} from "../../lib/ai/google-narrative";
import { buildGoogleExtractionGenerator } from "../../lib/ai/google-extraction";
import { enrichExtraction } from "../../lib/ai/intake-enricher";
import {
    newSessionId,
    saveIntakeSession,
    type IntakeSource,
} from "../../lib/intake-session-store";

export interface StartIntakeInput {
    readonly source: IntakeSource;
    readonly label: string;
    readonly text: string;
}

export interface StartIntakeResult {
    readonly ok: boolean;
    readonly sessionId?: string;
    readonly error?: string;
    readonly llmUsed: boolean;
}

const MAX_TEXT_CHARS = 60_000;

export async function startIntakeFromTextAction(
    input: StartIntakeInput,
): Promise<StartIntakeResult> {
    const text = input.text.slice(0, MAX_TEXT_CHARS).trim();
    if (text.length === 0) {
        return { ok: false, error: "empty text", llmUsed: false };
    }

    let extracted: ExtractedProfile = { academic: {}, budget: {} };
    let llmUsed = false;

    if (isGoogleConfigured()) {
        try {
            const r = await extractProfileFromText({
                locale: "zh",
                text,
                generate: buildGoogleExtractionGenerator(),
            });
            if (r.ok) {
                extracted = r.value;
                llmUsed = true;
                // eslint-disable-next-line no-console
                console.info(
                    `[intake-extraction] Gemini extracted ${countFields(
                        extracted,
                    )} field(s) from ${input.label}`,
                );
            } else {
                // eslint-disable-next-line no-console
                console.warn(
                    `[intake-extraction] ${r.error.kind}; review page will start empty`,
                    r.error.message,
                );
            }
        } catch (cause) {
            // eslint-disable-next-line no-console
            console.warn(
                "[intake-extraction] LLM call threw; review page will start empty",
                cause,
            );
        }
    } else {
        // eslint-disable-next-line no-console
        console.info(
            "[intake-extraction] GOOGLE_GENERATIVE_AI_API_KEY not set; review page will start empty",
        );
    }

    // Always run the deterministic regex enricher to backfill obvious
    // signals the LLM missed (or to cover the case where the LLM call
    // failed entirely). Enricher only fills gaps; existing AI signals win.
    const enriched = enrichExtraction(extracted, text);
    if (countFields(enriched) > countFields(extracted)) {
        // eslint-disable-next-line no-console
        console.info(
            `[intake-extraction] enricher added ${countFields(enriched) - countFields(extracted)
            } field(s) via regex`,
        );
    }

    const id = newSessionId();
    await saveIntakeSession({
        id,
        created_at: new Date().toISOString(),
        source: { kind: input.source, label: input.label, text },
        extracted: enriched,
    });

    return { ok: true, sessionId: id, llmUsed };
}

function countFields(extracted: ExtractedProfile): number {
    let n = 0;
    for (const v of Object.values(extracted.academic)) if (v) n += 1;
    for (const v of Object.values(extracted.budget)) if (v) n += 1;
    return n;
}
