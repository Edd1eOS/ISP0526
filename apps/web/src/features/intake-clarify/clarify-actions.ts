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
import { runDeterministicTurn, stripMarker } from "./clarify-fallback";

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
    readonly degraded?: boolean;
    readonly error?: string;
}

function fallbackTurn(
    messages: ReadonlyArray<ClarifyMessage>,
    missingKeys: ReadonlyArray<FormFieldKey>,
    note?: string,
): ClarifyTurnResult {
    const r = runDeterministicTurn({
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        missingKeys,
    });
    const prefix = note ? `（${note}，先用脱机问答继续）\n` : "";
    return {
        ok: true,
        reply: prefix + r.reply,
        patch: r.patch,
        done: r.done,
        degraded: true,
    };
}

function sanitize(messages: ReadonlyArray<ClarifyMessage>): ClarifyMessage[] {
    return messages.map((m) => ({ ...m, content: stripMarker(m.content) }));
}

export async function clarifyTurnAction(
    input: ClarifyTurnInput,
): Promise<ClarifyTurnResult> {
    const session = await loadIntakeSession(input.sessionId);
    if (!session) {
        return { ok: false, error: "会话已过期，请重新开始。" };
    }

    if (!isGoogleConfigured()) {
        return fallbackTurn(input.messages, input.missingKeys, "AI 未配置");
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
            messages: sanitize(trimmed).map((m) => ({
                role: m.role,
                content: m.content,
            })),
        });
        return {
            ok: true,
            reply: object.reply,
            patch: object.patch,
            done: object.done,
        };
    } catch (cause) {
        const message =
            cause instanceof Error ? cause.message : String(cause);
        // eslint-disable-next-line no-console
        console.warn("[intake-clarify] LLM failed, using fallback:", message);
        const note = /quota|rate.?limit|429/i.test(message)
            ? "AI 暂时累了"
            : "AI 暂时连不上";
        return fallbackTurn(input.messages, input.missingKeys, note);
    }
}
