"use client";

// IM-style follow-up chat surface. Posts to /r/[code]/chat which calls the
// LLM through the core adapter. Renders the assistant reply plus suggested
// followups; every assistant message is paired with the source_ids the
// adapter retained after post-filtering.

import { useState } from "react";

interface ChatCitation {
    readonly source_id: string;
    readonly note: string;
}

interface AssistantMessage {
    readonly role: "assistant";
    readonly content: string;
    readonly citations: ReadonlyArray<ChatCitation>;
    readonly followups: ReadonlyArray<string>;
}

interface UserMessage {
    readonly role: "user";
    readonly content: string;
}

type Message = AssistantMessage | UserMessage;

const SUGGESTED_QUESTIONS = [
    "推荐里学费最划算的是哪个？",
    "签证办理需要多久？",
    "如果我想之后留在当地工作，哪些项目更合适？",
];

export function ReportChat({ code }: { code: string }) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function ask(question: string) {
        const trimmed = question.trim();
        if (!trimmed || pending) return;
        setInput("");
        setError(null);
        const nextHistory: Message[] = [
            ...messages,
            { role: "user", content: trimmed },
        ];
        setMessages(nextHistory);
        setPending(true);
        try {
            const response = await fetch(`/r/${code}/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    question: trimmed,
                    locale: "zh",
                    history: nextHistory.slice(-8).map((m) => ({
                        role: m.role,
                        content: m.content,
                    })),
                }),
            });
            const data = await response.json();
            if (!response.ok) {
                const detail =
                    typeof data?.message === "string"
                        ? data.message
                        : typeof data?.error === "string"
                            ? data.error
                            : "对话服务暂时不可用，请稍后再试。";
                setError(detail);
                return;
            }
            const reply: AssistantMessage = {
                role: "assistant",
                content: typeof data.reply === "string" ? data.reply : "",
                citations: Array.isArray(data.citations) ? data.citations : [],
                followups: Array.isArray(data.followups) ? data.followups : [],
            };
            setMessages((m) => [...m, reply]);
        } catch (cause) {
            setError(
                cause instanceof Error ? cause.message : "网络出错，请稍后再试。",
            );
        } finally {
            setPending(false);
        }
    }

    return (
        <section
            className="space-y-4 p-6"
            style={{
                background: "var(--color-surface-alt)",
                borderRadius: "var(--radius-card-md)",
                boxShadow: "var(--shadow-clay-raised)",
            }}
        >
            <header className="space-y-1">
                <h2 className="text-text text-lg font-semibold">追问 AI 顾问</h2>
                <p className="text-text-muted text-xs">
                    回答只基于本报告里的项目与签证数据。AI 不替代真人顾问，所有信息以官方为准。
                </p>
            </header>

            <div className="space-y-3">
                {messages.length === 0 ? (
                    <div className="space-y-2">
                        <p className="text-text-muted text-xs">不知道问什么？试试：</p>
                        <div className="flex flex-wrap gap-2">
                            {SUGGESTED_QUESTIONS.map((q) => (
                                <button
                                    key={q}
                                    type="button"
                                    onClick={() => ask(q)}
                                    disabled={pending}
                                    className="text-text px-3 py-1.5 text-xs transition-transform active:scale-95 disabled:opacity-60"
                                    style={{
                                        background: "var(--color-surface)",
                                        borderRadius: "var(--radius-button)",
                                        boxShadow: "var(--shadow-clay-raised)",
                                    }}
                                >
                                    {q}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : null}

                {messages.map((m, i) =>
                    m.role === "user" ? (
                        <div
                            key={i}
                            className="text-text ml-auto max-w-[80%] px-4 py-2 text-sm"
                            style={{
                                background: "var(--gradient-raised)",
                                borderRadius: "var(--radius-card-sm, 12px)",
                                boxShadow: "var(--shadow-clay-raised)",
                            }}
                        >
                            {m.content}
                        </div>
                    ) : (
                        <div
                            key={i}
                            className="text-text mr-auto max-w-[85%] space-y-2 px-4 py-3 text-sm"
                            style={{
                                background: "var(--color-surface)",
                                borderRadius: "var(--radius-card-sm, 12px)",
                                boxShadow: "var(--shadow-clay-card)",
                            }}
                        >
                            <p className="whitespace-pre-wrap leading-relaxed">
                                {m.content}
                            </p>
                            {m.citations.length > 0 ? (
                                <ul className="text-text-muted space-y-0.5 text-[10px]">
                                    {m.citations.map((c, idx) => (
                                        <li key={idx}>
                                            来源：{c.source_id} · {c.note}
                                        </li>
                                    ))}
                                </ul>
                            ) : null}
                            {m.followups.length > 0 ? (
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                    {m.followups.map((f, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={() => ask(f)}
                                            disabled={pending}
                                            className="text-text-muted px-2 py-0.5 text-[11px] disabled:opacity-60"
                                            style={{
                                                background:
                                                    "var(--color-surface-alt)",
                                                borderRadius:
                                                    "var(--radius-button)",
                                            }}
                                        >
                                            {f}
                                        </button>
                                    ))}
                                </div>
                            ) : null}
                        </div>
                    ),
                )}

                {pending ? (
                    <div
                        className="text-text-muted mr-auto max-w-[60%] px-4 py-2 text-xs"
                        style={{
                            background: "var(--color-surface)",
                            borderRadius: "var(--radius-card-sm, 12px)",
                            boxShadow: "var(--shadow-clay-card)",
                        }}
                    >
                        正在生成…
                    </div>
                ) : null}

                {error ? (
                    <p className="text-text text-xs" role="alert">
                        {error}
                    </p>
                ) : null}
            </div>

            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    ask(input);
                }}
                className="flex gap-2 pt-2"
            >
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="比如：学费高的项目奖学金机会怎么样？"
                    disabled={pending}
                    maxLength={500}
                    className="text-text flex-1 px-4 py-2 text-sm outline-none disabled:opacity-60"
                    style={{
                        background: "var(--color-surface)",
                        borderRadius: "var(--radius-button)",
                        boxShadow: "var(--shadow-clay-inset)",
                    }}
                />
                <button
                    type="submit"
                    disabled={pending || input.trim().length === 0}
                    className="text-text-on-primary px-5 py-2 text-sm font-semibold transition-transform active:scale-95 disabled:opacity-60"
                    style={{
                        background: "var(--gradient-primary)",
                        borderRadius: "var(--radius-button)",
                        boxShadow: "var(--shadow-clay-primary)",
                    }}
                >
                    发送
                </button>
            </form>
        </section>
    );
}
