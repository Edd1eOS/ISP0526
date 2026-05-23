"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { clarifyTurnAction } from "./clarify-actions";
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

// Marker used by the deterministic fallback to remember which field was
// just asked; strip from anything we render in user-facing bubbles.
const MARKER_RE = /\[\[ask:\w+\]\]/g;

function clean(text: string): string {
    return text.replace(MARKER_RE, "").trim();
}

export function ClarifyChat({
    sessionId,
    currentValues,
    missingKeys,
    onPatch,
}: ClarifyChatProps) {
    const [messages, setMessages] = useState<ClarifyMessage[]>([]);
    const [input, setInput] = useState("");
    const [pending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState(false);
    const [degraded, setDegraded] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const opened = useRef(false);

    // Auto-open: as soon as the component mounts, ask the server for the
    // first question so the conversation starts in the student's lane,
    // not in a generic hello.
    useEffect(() => {
        if (opened.current) return;
        opened.current = true;
        startTransition(async () => {
            const res = await clarifyTurnAction({
                sessionId,
                messages: [],
                currentValues,
                missingKeys,
            });
            if (!res.ok) {
                setError(res.error ?? "追问启动失败");
                return;
            }
            if (res.patch) onPatch(res.patch);
            if (res.done) setDone(true);
            if (res.degraded) setDegraded(true);
            setMessages([{ role: "assistant", content: res.reply ?? "" }]);
        });
        // reason: only on mount; subsequent currentValues/missingKeys edits
        // shouldn't restart the chat.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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
                setError(res.error ?? "AI 暂时没空，请稍后再聊。");
                return;
            }
            if (res.patch) onPatch(res.patch);
            if (res.done) setDone(true);
            if (res.degraded) setDegraded(true);
            else setDegraded(false);
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
                        : degraded
                          ? "AI 在线服务暂时受限，已切到内置脚本继续追问；回答仍会自动填到右边表单。"
                          : "AI 会按重要性挨个问。你的回答会自动填到右边表单。"}
                </p>
            </header>

            <div
                ref={scrollRef}
                className="space-y-3 p-3 text-sm"
                style={{
                    background: "var(--color-surface-alt)",
                    borderRadius: "var(--radius-card-sm)",
                    maxHeight: "320px",
                    minHeight: "120px",
                    overflowY: "auto",
                }}
            >
                {messages.length === 0 && pending ? (
                    <Bubble role="assistant" content="正在准备第一个问题…" muted />
                ) : null}
                {messages.map((m, i) => (
                    <Bubble key={i} role={m.role} content={clean(m.content)} />
                ))}
                {messages.length > 0 && pending ? (
                    <Bubble role="assistant" content="思考中…" muted />
                ) : null}
            </div>

            {error ? <p className="text-warning text-xs">{error}</p> : null}

            <div className="flex items-end gap-2">
                <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder={
                        done
                            ? "都聊清楚了。还想补充就在这里继续打字。"
                            : "直接打字回答上面的问题，回车发送"
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
                    className="text-text rounded-button px-4 py-2 text-sm font-medium disabled:opacity-40"
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
        <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
            <div
                className="max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed"
                style={{
                    // Softer user bubble so it doesn't read as a quick-reply
                    // button. AI bubble stays white-on-surface for contrast.
                    background: isUser
                        ? "var(--color-bg)"
                        : "var(--color-surface)",
                    color: "var(--color-text)",
                    border: isUser
                        ? "1px solid var(--color-primary-from)"
                        : "1px solid transparent",
                    boxShadow: isUser ? "none" : "var(--shadow-clay-card)",
                    opacity: muted ? 0.65 : 1,
                }}
            >
                {content}
            </div>
        </div>
    );
}
