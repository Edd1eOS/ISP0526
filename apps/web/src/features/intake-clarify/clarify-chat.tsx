"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { clarifyTurnAction } from "./clarify-actions";
import { buildOpeningMessage } from "./clarify-prompt";
import type {
    ClarifyMessage,
    ClarifyPatch,
    FormFieldKey,
} from "./clarify-schema";

interface ClarifyChatProps {
    readonly sessionId: string;
    readonly currentValues: Readonly<Record<string, unknown>>;
    readonly missingKeys: ReadonlyArray<FormFieldKey>;
    readonly onPatch: (patch: ClarifyPatch) => void;
}

export function ClarifyChat({
    sessionId,
    currentValues,
    missingKeys,
    onPatch,
}: ClarifyChatProps) {
    const [messages, setMessages] = useState<ClarifyMessage[]>(() => [
        { role: "assistant", content: buildOpeningMessage(missingKeys) },
    ]);
    const [input, setInput] = useState("");
    const [pending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState(missingKeys.length === 0);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to the latest message.
    useEffect(() => {
        const el = scrollRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, [messages, pending]);

    function send() {
        const text = input.trim();
        if (!text || pending) return;
        const next: ClarifyMessage[] = [
            ...messages,
            { role: "user", content: text },
        ];
        setMessages(next);
        setInput("");
        setError(null);
        startTransition(async () => {
            const res = await clarifyTurnAction({
                sessionId,
                messages: next,
                currentValues,
                missingKeys,
            });
            if (!res.ok) {
                setError(res.error ?? "追问失败，请稍后再试。");
                return;
            }
            if (res.patch) onPatch(res.patch);
            if (res.done) setDone(true);
            setMessages([
                ...next,
                { role: "assistant", content: res.reply ?? "" },
            ]);
        });
    }

    function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            send();
        }
    }

    return (
        <section
            className="space-y-4 p-5"
            style={{
                background: "var(--color-surface)",
                borderRadius: "var(--radius-card-md)",
                boxShadow: "var(--shadow-clay-card)",
            }}
            aria-label="AI 追问"
        >
            <header className="space-y-1">
                <p className="text-text-muted text-xs uppercase tracking-widest">
                    Step 2.5 · AI 追问
                </p>
                <h2 className="text-text text-lg font-semibold">
                    {done ? "聊清楚了，可以出报告" : "聊两句把空填上"}
                </h2>
                <p className="text-text-muted text-xs">
                    {done
                        ? "右边表单已经齐全。如果还想改，直接编辑，然后点最底下的按钮。"
                        : "AI 看了你的输入，会主动问几个关键问题。你的回答会自动填到右边表单。"}
                </p>
            </header>

            <div
                ref={scrollRef}
                className="space-y-3 p-3 text-sm"
                style={{
                    background: "var(--color-surface-alt)",
                    borderRadius: "var(--radius-card-sm)",
                    maxHeight: "280px",
                    overflowY: "auto",
                }}
            >
                {messages.map((m, i) => (
                    <Bubble key={i} role={m.role} content={m.content} />
                ))}
                {pending ? (
                    <Bubble role="assistant" content="正在想…" muted />
                ) : null}
            </div>

            {error ? (
                <p className="text-warning text-xs">{error}</p>
            ) : null}

            <div className="flex items-end gap-2">
                <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder={
                        done
                            ? "都聊清楚了。还想补充就在这里继续打字。"
                            : "比如：预算是澳币 / 想去悉尼 / GPA 大概 3.6"
                    }
                    rows={2}
                    disabled={pending}
                    className="form-control flex-1"
                    style={{ resize: "none" }}
                />
                <button
                    type="button"
                    onClick={send}
                    disabled={pending || !input.trim()}
                    className="text-text rounded-button px-4 py-2 text-sm font-medium disabled:opacity-50"
                    style={{
                        background: "var(--gradient-raised)",
                        boxShadow: "var(--shadow-clay-card)",
                    }}
                >
                    {pending ? "发送中" : "发送"}
                </button>
            </div>
        </section>
    );
}

function Bubble({
    role,
    content,
    muted,
}: {
    role: "user" | "assistant";
    content: string;
    muted?: boolean;
}) {
    const isUser = role === "user";
    return (
        <div
            className={`flex ${isUser ? "justify-end" : "justify-start"}`}
        >
            <div
                className="max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed"
                style={{
                    background: isUser
                        ? "var(--gradient-primary)"
                        : "var(--color-surface)",
                    color: isUser ? "white" : "var(--color-text)",
                    boxShadow: "var(--shadow-clay-card)",
                    opacity: muted ? 0.6 : 1,
                }}
            >
                {content}
            </div>
        </div>
    );
}
