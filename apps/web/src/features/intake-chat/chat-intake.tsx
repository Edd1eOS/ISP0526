"use client";

import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    useTransition,
} from "react";
import { trackEvent } from "../../lib/analytics/track";
import {
    chatIntakeTurnAction,
    finalizeChatIntakeAction,
    type ChatMessage,
} from "./chat-actions";
import { MIN_SUPPORTING_SIGNALS } from "./chat-prompt";
import type { ClarifyPatch } from "../intake-clarify/clarify-schema";

interface Bubble {
    readonly id: string;
    readonly role: "assistant" | "user";
    readonly content: string;
}

function uid(): string {
    return Math.random().toString(36).slice(2, 10);
}

function countSignals(p: ClarifyPatch): number {
    let n = 0;
    if (p.target_field) n += 1;
    if (p.annual_budget_aud) n += 1;
    if (p.preferred_tags && p.preferred_tags.length > 0) n += 1;
    if (p.gpa !== undefined) n += 1;
    if (p.ielts_overall !== undefined) n += 1;
    if (p.teaching_style) n += 1;
    if (p.city_size) n += 1;
    return n;
}

export function ChatIntake() {
    const [bubbles, setBubbles] = useState<ReadonlyArray<Bubble>>([]);
    const [accumulated, setAccumulated] = useState<ClarifyPatch>({});
    const [quickReplies, setQuickReplies] = useState<ReadonlyArray<string>>(
        [],
    );
    const [done, setDone] = useState(false);
    const [draft, setDraft] = useState("");
    const [pending, startTransition] = useTransition();
    const [finalizing, setFinalizing] = useState(false);
    const [degraded, setDegraded] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const openedRef = useRef(false);
    const scrollerRef = useRef<HTMLDivElement | null>(null);

    const signals = useMemo(() => countSignals(accumulated), [accumulated]);
    const hasLevel = Boolean(accumulated.target_level);
    const canFinalize = hasLevel && signals >= MIN_SUPPORTING_SIGNALS;

    useEffect(() => {
        const el = scrollerRef.current;
        if (!el) return;
        el.scrollTop = el.scrollHeight;
    }, [bubbles, pending]);

    const sendTurn = useCallback(
        (history: ReadonlyArray<Bubble>, patch: ClarifyPatch) => {
            const messages: ChatMessage[] = history.map((b) => ({
                role: b.role,
                content: b.content,
            }));
            startTransition(async () => {
                setError(null);
                try {
                    const r = await chatIntakeTurnAction({
                        messages,
                        accumulated: patch,
                    });
                    if (!r.ok) {
                        setError(r.error ?? "出错了，再试一次？");
                        return;
                    }
                    if (r.degraded) setDegraded(true);
                    if (r.patch) {
                        setAccumulated((prev) => ({ ...prev, ...r.patch }));
                    }
                    if (r.reply) {
                        setBubbles((prev) => [
                            ...prev,
                            {
                                id: uid(),
                                role: "assistant",
                                content: r.reply!,
                            },
                        ]);
                    }
                    setQuickReplies(r.quickReplies ?? []);
                    if (r.done) setDone(true);
                } catch (cause) {
                    // eslint-disable-next-line no-console
                    console.error("[chat-intake] turn failed", cause);
                    setError("网络好像不太顺，再试一次？");
                }
            });
        },
        [],
    );

    useEffect(() => {
        if (openedRef.current) return;
        openedRef.current = true;
        trackEvent("intake_step_start", { channel: "chat", step: 0 });
        sendTurn([], {});
    }, [sendTurn]);

    const pushUser = (text: string) => {
        const trimmed = text.trim();
        if (!trimmed) return;
        const userBubble: Bubble = {
            id: uid(),
            role: "user",
            content: trimmed,
        };
        const nextHistory = [...bubbles, userBubble];
        setBubbles(nextHistory);
        setQuickReplies([]);
        setDraft("");
        sendTurn(nextHistory, accumulated);
    };

    const onSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (pending || done) return;
        pushUser(draft);
    };

    const onFinalize = () => {
        if (!canFinalize || finalizing) return;
        setFinalizing(true);
        trackEvent("intake_submitted", { channel: "chat" });
        startTransition(async () => {
            try {
                await finalizeChatIntakeAction(accumulated);
            } catch (cause) {
                if (
                    cause &&
                    typeof cause === "object" &&
                    "digest" in cause &&
                    typeof (cause as { digest: unknown }).digest === "string" &&
                    (cause as { digest: string }).digest.startsWith(
                        "NEXT_REDIRECT",
                    )
                ) {
                    return;
                }
                // eslint-disable-next-line no-console
                console.error("[chat-intake] finalize failed", cause);
                setError("生成报告失败，请再试一次。");
                setFinalizing(false);
            }
        });
    };

    const progressPct = Math.min(
        100,
        Math.round(
            (((hasLevel ? 1 : 0) + signals) / (1 + MIN_SUPPORTING_SIGNALS)) *
                100,
        ),
    );

    return (
        <div
            className="mx-auto flex w-full max-w-2xl flex-col"
            style={{
                height: "min(80vh, 720px)",
                background: "var(--color-surface)",
                borderRadius: "var(--radius-card-md)",
                boxShadow: "var(--shadow-clay-card)",
                overflow: "hidden",
            }}
        >
            <header
                className="flex items-center justify-between gap-3 px-5 py-3"
                style={{
                    background: "var(--color-surface-alt)",
                    borderBottom: "1px solid rgba(0,0,0,0.04)",
                }}
            >
                <div className="flex items-center gap-3">
                    <div
                        aria-hidden
                        className="flex h-9 w-9 items-center justify-center text-sm font-semibold"
                        style={{
                            background: "var(--gradient-primary)",
                            color: "var(--color-text-on-primary)",
                            borderRadius: 999,
                        }}
                    >
                        AI
                    </div>
                    <div className="leading-tight">
                        <p className="text-text text-sm font-semibold">
                            留学顾问助手
                        </p>
                        <p className="text-text-muted text-[11px]">
                            {degraded
                                ? "AI 暂时离线，已切到兜底问句"
                                : "在线，按你的节奏聊"}
                        </p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={onFinalize}
                    disabled={!canFinalize || finalizing}
                    className="text-xs font-semibold transition-opacity disabled:opacity-40"
                    style={{
                        background: canFinalize
                            ? "var(--gradient-primary)"
                            : "var(--color-surface)",
                        color: canFinalize
                            ? "var(--color-text-on-primary)"
                            : "var(--color-text-muted)",
                        borderRadius: "var(--radius-button)",
                        padding: "6px 12px",
                        boxShadow: canFinalize
                            ? "var(--shadow-clay-primary)"
                            : "none",
                    }}
                >
                    {finalizing ? "生成中…" : "直接看推荐"}
                </button>
            </header>

            <div
                className="h-1"
                style={{ background: "var(--color-surface-alt)" }}
                aria-hidden
            >
                <div
                    className="h-full transition-all"
                    style={{
                        width: `${progressPct}%`,
                        background: "var(--gradient-primary)",
                    }}
                />
            </div>

            <div
                ref={scrollerRef}
                className="flex-1 space-y-3 overflow-y-auto px-4 py-5 sm:px-5"
            >
                {bubbles.map((b) => (
                    <BubbleRow key={b.id} bubble={b} />
                ))}
                {pending ? <TypingBubble /> : null}
                {error ? (
                    <p
                        className="text-center text-xs"
                        style={{ color: "var(--color-danger)" }}
                    >
                        {error}
                    </p>
                ) : null}
            </div>

            {quickReplies.length > 0 && !done ? (
                <div
                    className="flex flex-wrap gap-2 px-4 pb-2 pt-1 sm:px-5"
                    role="group"
                    aria-label="快捷回复"
                >
                    {quickReplies.map((q) => (
                        <button
                            key={q}
                            type="button"
                            disabled={pending}
                            onClick={() => pushUser(q)}
                            className="text-text px-3 py-1.5 text-xs font-medium transition-transform active:scale-95 disabled:opacity-40"
                            style={{
                                background: "var(--color-surface-alt)",
                                borderRadius: 999,
                                boxShadow: "var(--shadow-clay-raised)",
                            }}
                        >
                            {q}
                        </button>
                    ))}
                </div>
            ) : null}

            <form
                onSubmit={onSubmit}
                className="flex items-end gap-2 border-t px-4 py-3 sm:px-5"
                style={{ borderColor: "rgba(0,0,0,0.04)" }}
            >
                <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                        if (
                            e.key === "Enter" &&
                            !e.shiftKey &&
                            !e.nativeEvent.isComposing
                        ) {
                            e.preventDefault();
                            onSubmit(e);
                        }
                    }}
                    placeholder={
                        done
                            ? "已经聊够了，可以看推荐了"
                            : "写点什么…（Shift+Enter 换行）"
                    }
                    rows={1}
                    disabled={pending || done}
                    className="text-text flex-1 resize-none px-3 py-2 text-sm leading-relaxed outline-none disabled:opacity-60"
                    style={{
                        background: "var(--color-surface-alt)",
                        borderRadius: "var(--radius-card-sm)",
                        boxShadow: "var(--shadow-clay-inset)",
                        maxHeight: 120,
                    }}
                />
                <button
                    type="submit"
                    disabled={
                        pending || done || draft.trim().length === 0
                    }
                    className="text-text-on-primary shrink-0 px-4 py-2 text-sm font-semibold transition-transform active:scale-95 disabled:opacity-40"
                    style={{
                        background: "var(--gradient-primary)",
                        borderRadius: "var(--radius-button)",
                        boxShadow: "var(--shadow-clay-primary)",
                        color: "var(--color-text-on-primary)",
                    }}
                >
                    发送
                </button>
            </form>

            {done ? (
                <div
                    className="border-t px-4 py-3 sm:px-5"
                    style={{ borderColor: "rgba(0,0,0,0.04)" }}
                >
                    <button
                        type="button"
                        onClick={onFinalize}
                        disabled={finalizing}
                        className="w-full px-4 py-3 text-sm font-semibold transition-transform active:scale-95 disabled:opacity-60"
                        style={{
                            background: "var(--gradient-primary)",
                            borderRadius: "var(--radius-button)",
                            boxShadow: "var(--shadow-clay-primary)",
                            color: "var(--color-text-on-primary)",
                        }}
                    >
                        {finalizing ? "生成中…" : "查看我的推荐"}
                    </button>
                </div>
            ) : null}
        </div>
    );
}

function BubbleRow({ bubble }: { bubble: Bubble }) {
    const mine = bubble.role === "user";
    return (
        <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
            <div
                className="max-w-[78%] whitespace-pre-wrap break-words px-3.5 py-2 text-sm leading-relaxed"
                style={{
                    background: mine
                        ? "var(--gradient-primary)"
                        : "var(--color-surface-alt)",
                    color: mine
                        ? "var(--color-text-on-primary)"
                        : "var(--color-text)",
                    borderRadius: mine
                        ? "18px 18px 4px 18px"
                        : "18px 18px 18px 4px",
                    boxShadow: mine
                        ? "var(--shadow-clay-primary)"
                        : "var(--shadow-clay-raised)",
                }}
            >
                {bubble.content}
            </div>
        </div>
    );
}

function TypingBubble() {
    return (
        <div className="flex justify-start">
            <div
                className="flex items-center gap-1 px-3.5 py-2"
                style={{
                    background: "var(--color-surface-alt)",
                    borderRadius: "18px 18px 18px 4px",
                    boxShadow: "var(--shadow-clay-raised)",
                }}
                aria-label="AI 正在输入"
            >
                <Dot delay="0ms" />
                <Dot delay="160ms" />
                <Dot delay="320ms" />
            </div>
        </div>
    );
}

function Dot({ delay }: { delay: string }) {
    return (
        <span
            className="block h-1.5 w-1.5"
            style={{
                background: "var(--color-text-muted)",
                borderRadius: 999,
                animation: "chatDot 1.2s ease-in-out infinite",
                animationDelay: delay,
                opacity: 0.6,
            }}
        />
    );
}
