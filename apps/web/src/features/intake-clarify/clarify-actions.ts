"use server";

import { generateText, Output } from "ai";
import { loadIntakeSession } from "@/lib/intake-session-store";
import {
    getTextModel,
    isLLMConfigured,
} from "@/lib/ai/google-narrative";
import {
    ClarifyTurnSchema,
    type ClarifyMessage,
    type ClarifyPatch,
    type FormFieldKey,
} from "./clarify-schema";
import { buildClarifySystemPrompt } from "./clarify-prompt";
import { runDeterministicTurn, stripMarker } from "./clarify-fallback";

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
): ClarifyTurnResult {
    const r = runDeterministicTurn({
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        missingKeys,
    });
    // No per-message "AI 暂时累了" prefix — the chat header banner already
    // tells the user we're in offline mode. Don't double-announce.
    return {
        ok: true,
        reply: r.reply,
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

    if (!isLLMConfigured()) {
        return fallbackTurn(input.messages, input.missingKeys);
    }

    const trimmed = input.messages.slice(-MAX_MESSAGES);
    const system = buildClarifySystemPrompt({
        sourceText: session.source.text,
        currentValues: input.currentValues,
        missingKeys: input.missingKeys,
    });

    try {
        const { output } = await generateText({
            model: getTextModel(),
            output: Output.object({ schema: ClarifyTurnSchema }),
            system,
            messages: sanitize(trimmed).map((m) => ({
                role: m.role,
                content: m.content,
            })),
        });
        const object = output;
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
        return fallbackTurn(input.messages, input.missingKeys);
    }
}
