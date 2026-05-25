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
import { mergePatchDeep } from "./intake-state";

const ASSESSMENT_KEY = "isp_assessment_v1";
const INTAKE_PATCH_KEY = "isp_intake_accumulated_v1";

function readAccumulatedFromSession(): ClarifyPatch {
    if (typeof window === "undefined") return {};
    try {
        const raw = window.sessionStorage.getItem(INTAKE_PATCH_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
            return parsed as ClarifyPatch;
        }
        return {};
    } catch {
        return {};
    }
}

function writeAccumulatedToSession(p: ClarifyPatch) {
    if (typeof window === "undefined") return;
    try {
        window.sessionStorage.setItem(
            INTAKE_PATCH_KEY,
            JSON.stringify(p),
        );
    } catch {
        // ignore quota / private-mode errors; in-memory state still works.
    }
}

function readAssessmentFromSession() {
    if (typeof window === "undefined") return undefined;
    try {
        const raw = window.sessionStorage.getItem(ASSESSMENT_KEY);
        if (!raw) return undefined;
        return JSON.parse(raw) as Parameters<
            typeof finalizeChatIntakeAction
        >[1];
    } catch {
        return undefined;
    }
}
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
    const skipped = new Set(p.skipped_fields ?? []);
    let n = 0;
    if (p.target_field || skipped.has("target_field")) n += 1;
    if (p.annual_budget_aud || skipped.has("annual_budget_aud")) n += 1;
    if (
        (p.preferred_tags && p.preferred_tags.length > 0) ||
        skipped.has("preferred_tags")
    )
        n += 1;
    if (p.gpa !== undefined || skipped.has("gpa")) n += 1;
    if (p.ielts_overall !== undefined || skipped.has("ielts_overall")) n += 1;
    if (p.teaching_style || skipped.has("teaching_style")) n += 1;
    if (p.city_size || skipped.has("city_size")) n += 1;
    return n;
}

export function ChatIntake() {
    const [bubbles, setBubbles] = useState<ReadonlyArray<Bubble>>([]);
    const [accumulated, setAccumulated] = useState<ClarifyPatch>({});
    const [quickReplies, setQuickReplies] = useState<ReadonlyArray<string>>(
        [],
    );
    const [inputMode, setInputMode] = useState<
        "single" | "multi" | "number"
    >("single");
    const [multiSelected, setMultiSelected] = useState<ReadonlyArray<string>>(
        [],
    );
    const [done, setDone] = useState(false);
    const [draft, setDraft] = useState("");
    const [pending, startTransition] = useTransition();
    const [finalizing, setFinalizing] = useState(false);
    const [degraded, setDegraded] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const openedRef = useRef(false);
    const assessmentRef = useRef<
        Parameters<typeof finalizeChatIntakeAction>[1] | undefined
    >(undefined);
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
                        assessment: assessmentRef.current,
                    });
                    if (!r.ok) {
                        setError(r.error ?? "出错了，再试一次？");
                        return;
                    }
                    if (r.degraded) setDegraded(true);
                    if (r.patch) {
                        setAccumulated((prev) => {
                            const merged = mergePatchDeep(prev, r.patch);
                            writeAccumulatedToSession(merged);
                            return merged;
                        });
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
                    setQuickReplies(
                        normalizeQuickReplies(
                            r.reply ?? "",
                            r.inputMode ?? "single",
                            r.quickReplies ?? [],
                        ),
                    );
                    setInputMode(r.inputMode ?? "single");
                    setMultiSelected([]);
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
        assessmentRef.current = readAssessmentFromSession();
        const restored = readAccumulatedFromSession();
        if (Object.keys(restored).length > 0) {
            setAccumulated(restored);
        }
        trackEvent("intake_step_start", { channel: "chat", step: 0 });
        sendTurn([], restored);
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
        const assessment = readAssessmentFromSession();
        startTransition(async () => {
            try {
                await finalizeChatIntakeAction(accumulated, assessment);
                // Clear assessment payload on success so a refresh of the
                // report page does not re-use stale answers.
                try {
                    window.sessionStorage.removeItem(ASSESSMENT_KEY);
                    window.sessionStorage.removeItem(INTAKE_PATCH_KEY);
                } catch {
                    // ignore
                }
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
                                ? "正在用基础模式陪你聊"
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

            {quickReplies.length > 0 && !done && inputMode === "number" ? (
                <NumberSliderRow
                    spec={quickReplies[0]!}
                    disabled={pending}
                    onSubmit={(label) => pushUser(label)}
                />
            ) : null}

            {quickReplies.length > 0 && !done && inputMode === "multi" ? (
                <div className="px-4 pb-2 pt-1 sm:px-5">
                    <div
                        className="flex flex-wrap gap-2"
                        role="group"
                        aria-label="多选回复"
                    >
                        {quickReplies.map((q) => {
                            const active = multiSelected.includes(q);
                            return (
                                <button
                                    key={q}
                                    type="button"
                                    disabled={pending}
                                    onClick={() =>
                                        setMultiSelected((prev) =>
                                            prev.includes(q)
                                                ? prev.filter((x) => x !== q)
                                                : [...prev, q],
                                        )
                                    }
                                    className="text-text px-3 py-1.5 text-xs font-medium transition-transform active:scale-95 disabled:opacity-40"
                                    style={{
                                        background: active
                                            ? "var(--gradient-primary)"
                                            : "var(--color-surface-alt)",
                                        color: active
                                            ? "var(--color-text-on-primary)"
                                            : "var(--color-text)",
                                        borderRadius: 999,
                                        boxShadow: active
                                            ? "var(--shadow-clay-primary)"
                                            : "var(--shadow-clay-raised)",
                                    }}
                                >
                                    {q}
                                </button>
                            );
                        })}
                    </div>
                    <div className="mt-2 flex justify-end">
                        <button
                            type="button"
                            disabled={pending || multiSelected.length === 0}
                            onClick={() =>
                                pushUser(multiSelected.join("、"))
                            }
                            className="px-3 py-1.5 text-xs font-semibold transition-opacity disabled:opacity-40"
                            style={{
                                background: "var(--gradient-primary)",
                                color: "var(--color-text-on-primary)",
                                borderRadius: "var(--radius-button)",
                                boxShadow: "var(--shadow-clay-primary)",
                            }}
                        >
                            就这几个
                        </button>
                    </div>
                </div>
            ) : null}

            {quickReplies.length > 0 && !done && inputMode === "single" ? (
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

// Guard against LLM hallucinating slider ranges (e.g. returning 4,100,1,分
// for IELTS). Detect the field from the assistant's question text and force
// the canonical spec when applicable. Falls back to LLM-provided spec.
const NUMBER_SPEC_OVERRIDES: ReadonlyArray<{
    test: RegExp;
    spec: string;
}> = [
        { test: /雅思|ielts/i, spec: "4,9,0.5,分" },
        { test: /托福|toefl/i, spec: "40,120,1,分" },
        { test: /gpa|绩点|均分|平均分/i, spec: "0,100,1,分" },
        { test: /预算|学费|budget|aud|澳币|澳元/i, spec: "20000,200000,5000,AUD" },
    ];

function normalizeQuickReplies(
    reply: string,
    inputMode: "single" | "multi" | "number",
    raw: ReadonlyArray<string>,
): ReadonlyArray<string> {
    if (inputMode !== "number" || raw.length === 0) return raw;
    for (const o of NUMBER_SPEC_OVERRIDES) {
        if (o.test.test(reply)) return [o.spec];
    }
    return raw;
}

function parseSliderSpec(spec: string): {
    min: number;
    max: number;
    step: number;
    unit: string;
} {
    const parts = spec.split(",").map((s) => s.trim());
    const min = Number.parseFloat(parts[0] ?? "0");
    const max = Number.parseFloat(parts[1] ?? "100");
    const step = Number.parseFloat(parts[2] ?? "1");
    const unit = parts[3] ?? "";
    return {
        min: Number.isFinite(min) ? min : 0,
        max: Number.isFinite(max) ? max : 100,
        step: Number.isFinite(step) && step > 0 ? step : 1,
        unit,
    };
}

function NumberSliderRow({
    spec,
    disabled,
    onSubmit,
}: {
    spec: string;
    disabled: boolean;
    onSubmit: (label: string) => void;
}) {
    const { min, max, step, unit } = useMemo(
        () => parseSliderSpec(spec),
        [spec],
    );
    const [val, setVal] = useState<number>(() => (min + max) / 2);
    const display = Number.isInteger(step) ? String(val) : val.toFixed(1);
    return (
        <div className="px-4 pb-2 pt-1 sm:px-5">
            <div
                className="flex items-center justify-between text-xs"
                style={{ color: "var(--color-text-muted)" }}
            >
                <span>
                    {min}
                    {unit}
                </span>
                <span
                    className="text-sm font-semibold"
                    style={{ color: "var(--color-text)" }}
                >
                    {display}
                    {unit}
                </span>
                <span>
                    {max}
                    {unit}
                </span>
            </div>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={val}
                disabled={disabled}
                onChange={(e) => setVal(Number.parseFloat(e.target.value))}
                className="mt-1 w-full"
                aria-label="数值滑条"
            />
            <div className="mt-2 flex justify-end">
                <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onSubmit(`${display}${unit}`)}
                    className="px-3 py-1.5 text-xs font-semibold transition-opacity disabled:opacity-40"
                    style={{
                        background: "var(--gradient-primary)",
                        color: "var(--color-text-on-primary)",
                        borderRadius: "var(--radius-button)",
                        boxShadow: "var(--shadow-clay-primary)",
                    }}
                >
                    就这个数
                </button>
            </div>
        </div>
    );
}
