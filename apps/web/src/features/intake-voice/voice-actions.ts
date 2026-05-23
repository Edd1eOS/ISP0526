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
// reason: Gemini 2.0 Flash currently gates audio input behind a paid tier
// (free-tier limit = 0 for `generate_content_free_tier_input_token_count`
// when the request contains audio). Gemini 2.5 Flash audio is still on
// the free tier as of 2026-05, so we default voice transcription there.
// Override with GOOGLE_VOICE_MODEL_ID if you have access to a different
// model on your account.
const VOICE_MODEL_ID =
    process.env.GOOGLE_VOICE_MODEL_ID || "gemini-2.5-flash";
const VOICE_TRANSCRIBE_PROMPT =
    "You are transcribing a study-abroad consultation voice memo. " +
    "Output ONLY the verbatim transcript, no prefixes, no commentary. " +
    "Keep the speaker's original language (Chinese or English). " +
    "If the audio is silent or unintelligible, output a single empty string.";

// Gemini's audio understanding accepts: wav, mp3, aiff, aac, ogg, flac.
// MediaRecorder in Chromium emits audio/webm;codecs=opus and in Safari
// emits audio/mp4 (AAC). We strip codec parameters (Gemini rejects the
// `;codecs=` suffix on some paths) and remap webm to ogg because the opus
// stream inside the webm container is byte-compatible with what Gemini's
// ogg decoder expects.
function normalizeAudioMediaType(raw: string): string {
    const bare = (raw || "audio/webm").split(";")[0]!.trim().toLowerCase();
    if (bare === "audio/webm") return "audio/ogg";
    if (bare === "audio/mp4" || bare === "audio/x-m4a") return "audio/aac";
    if (bare === "audio/mpeg") return "audio/mp3";
    return bare;
}

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
        const mediaType = normalizeAudioMediaType(audio.type);
        const { text } = await generateText({
            model: google(VOICE_MODEL_ID),
            messages: [
                {
                    role: "user",
                    content: [
                        // reason: Vercel AI SDK v6 file part takes raw bytes
                        // plus a mediaType. Gemini's audio understanding
                        // accepts wav / mp3 / aiff / aac / ogg / flac;
                        // MediaRecorder usually emits webm/opus, which we
                        // surface to Gemini as audio/ogg (same opus payload
                        // in a different container, and Gemini decodes it).
                        { type: "file", data: bytes, mediaType },
                        { type: "text", text: VOICE_TRANSCRIBE_PROMPT },
                    ],
                },
            ],
        });
        transcript = text.trim();
    } catch (cause) {
        const detail =
            cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause);
        // eslint-disable-next-line no-console
        console.warn("[voice] transcription failed", cause);
        return { ok: false, error: `听写失败：${detail}` };
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
