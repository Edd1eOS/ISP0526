"use server";

import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { loadIntakeSession } from "@/lib/intake-session-store";
import { isGoogleConfigured } from "@/lib/ai/google-narrative";
import {
    ClarifyTurnSchema,
    type ClarifyMessage,
    type ClarifyPatch,
    type FormFieldKey,
} from "./clarify-schema";
import { buildClarifySystemPrompt } from "./clarify-prompt";

const MODEL_ID = "gemini-2.0-flash";
const MAX_MESSAGES = 20;

export interface ClarifyTurnInput {
    readonly sessionId: string;
    readonly messages: ReadonlyArray<ClarifyMessage>;
    readonly currentValues: Readonly<Record<string, unknown>>;
    readonly missingKeys: ReadonlyArray<FormFieldKey>;
}

export interface ClarifyTurnResult {
    readonly ok: boolean;
    readonly reply?: string;
    readonly patch?: ClarifyPatch;
    readonly done?: boolean;
    readonly error?: string;
}

export async function clarifyTurnAction(
    input: ClarifyTurnInput,
): Promise<ClarifyTurnResult> {
    if (!isGoogleConfigured()) {
        return {
            ok: false,
            error: "AI 未配置，无法启动追问。请直接核对右侧表单后提交。",
        };
    }

    const session = await loadIntakeSession(input.sessionId);
    if (!session) {
        return { ok: false, error: "会话已过期，请重新开始。" };
    }

    const trimmed = input.messages.slice(-MAX_MESSAGES);
    const system = buildClarifySystemPrompt({
        sourceText: session.source.text,
        currentValues: input.currentValues,
        missingKeys: input.missingKeys,
    });

    try {
        const { object } = await generateObject({
            model: google(MODEL_ID),
            schema: ClarifyTurnSchema,
            system,
            messages: trimmed.map((m) => ({ role: m.role, content: m.content })),
        });
        return {
            ok: true,
            reply: object.reply,
            patch: object.patch,
            done: object.done,
        };
    } catch (cause) {
        const detail =
            cause instanceof Error
                ? `${cause.name}: ${cause.message}`
                : "unknown error";
        // eslint-disable-next-line no-console
        console.warn("[intake-clarify] turn failed:", detail);
        return { ok: false, error: `追问失败：${detail}` };
    }
}
