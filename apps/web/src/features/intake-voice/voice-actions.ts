"use server";

import "server-only";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { extractProfileFromText, type ExtractedProfile } from "@isp0526/core";
import { isGoogleConfigured } from "../../lib/ai/google-narrative";
import { buildGoogleExtractionGenerator } from "../../lib/ai/google-extraction";
import {
    newSessionId,
    saveIntakeSession,
} from "../../lib/intake-session-store";

export interface VoiceIntakeResult {
    readonly ok: boolean;
    readonly sessionId?: string;
    readonly error?: string;
}

const MAX_AUDIO_BYTES = 15 * 1024 * 1024;
const VOICE_TRANSCRIBE_PROMPT =
    "You are transcribing a study-abroad consultation voice memo. " +
    "Output ONLY the verbatim transcript, no prefixes, no commentary. " +
    "Keep the speaker's original language (Chinese or English). " +
    "If the audio is silent or unintelligible, output a single empty string.";

export async function startIntakeFromAudioAction(
    formData: FormData,
): Promise<VoiceIntakeResult> {
    if (!isGoogleConfigured()) {
        return {
            ok: false,
            error: "GOOGLE_GENERATIVE_AI_API_KEY 没配置，先去 apps/web/.env.local 填一下",
        };
    }

    const audio = formData.get("audio");
    const secondsRaw = formData.get("seconds");
    if (!(audio instanceof Blob)) {
        return { ok: false, error: "missing audio blob" };
    }
    if (audio.size === 0) return { ok: false, error: "empty audio" };
    if (audio.size > MAX_AUDIO_BYTES) {
        return { ok: false, error: "录音文件超过 15 MB 上限" };
    }
    const seconds = Math.max(0, Math.round(Number(secondsRaw) || 0));

    let transcript = "";
    try {
        const bytes = new Uint8Array(await audio.arrayBuffer());
        const mediaType = audio.type || "audio/webm";
        const { text } = await generateText({
            model: google("gemini-2.0-flash"),
            messages: [
                {
                    role: "user",
                    content: [
                        // reason: Vercel AI SDK v6 file part takes raw bytes
                        // plus a mediaType; Gemini's multimodal endpoint
                        // accepts opus/webm and mp4 audio directly.
                        { type: "file", data: bytes, mediaType },
                        { type: "text", text: VOICE_TRANSCRIBE_PROMPT },
                    ],
                },
            ],
        });
        transcript = text.trim();
    } catch (cause) {
        // eslint-disable-next-line no-console
        console.warn("[voice] transcription failed", cause);
        return { ok: false, error: "听写失败，再试一次？" };
    }

    if (transcript.length === 0) {
        return { ok: false, error: "AI 没听到内容，靠近麦克风再说一次？" };
    }

    let extracted: ExtractedProfile = { academic: {}, budget: {} };
    try {
        const r = await extractProfileFromText({
            locale: "zh",
            text: transcript,
            generate: buildGoogleExtractionGenerator(),
        });
        if (r.ok) {
            extracted = r.value;
        } else {
            // eslint-disable-next-line no-console
            console.warn(
                `[voice] extraction ${r.error.kind}; review page starts with empty fields`,
                r.error.message,
            );
        }
    } catch (cause) {
        // eslint-disable-next-line no-console
        console.warn("[voice] extraction threw", cause);
    }

    const id = newSessionId();
    await saveIntakeSession({
        id,
        created_at: new Date().toISOString(),
        source: {
            kind: "voice",
            label: `语音输入 · 约 ${seconds}s`,
            text: transcript,
        },
        extracted,
    });

    return { ok: true, sessionId: id };
}
