"use client";

/**
 * VoyageStage
 *
 * First-person ocean-voyage UI for the "细节补充" intake step. Each LLM
 * follow-up question surfaces as a waypoint (island / lighthouse /
 * continent / reef) that drifts in from the horizon; the boat keeps
 * sailing between waypoints. Backend is the dedicated voyage prompt
 * (packages/core/src/ai/prompts/voyage-question.ts) which fills the rich
 * VoyageProfile schema — positive AND negative preferences, dealbreakers,
 * decisive factors, confirmation flags. On done we project the voyage
 * profile down to a ClarifyPatch overlay and hand off to the existing
 * finalizeChatIntakeAction so the recommender pipeline is unchanged.
 */

import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    useTransition,
} from "react";
import type {
    VoyageAssessmentSummary,
    VoyageHistoryTurn,
    VoyageProfile,
    VoyageQuestion,
    VoyageUploadContext,
} from "@isp0526/core";
import { trackEvent } from "../../lib/analytics/track";
import { finalizeChatIntakeAction } from "../intake-chat/chat-actions";
import { mergePatchDeep } from "../intake-chat/intake-state";
import type { ClarifyPatch } from "../intake-clarify/clarify-schema";
import type { AssessmentAnswers } from "../assessment/items";
import { scoreAssessment } from "../assessment/items";
import {
    nextVoyageTurnAction,
} from "./voyage-actions";
import { projectVoyageToClarifyPatch } from "./voyage-projection";

const ASSESSMENT_KEY = "isp_assessment_v1";
const INTAKE_PATCH_KEY = "isp_intake_accumulated_v1";
const VOYAGE_PROFILE_KEY = "isp_voyage_profile_v1";
const VOYAGE_HISTORY_KEY = "isp_voyage_history_v1";
const UPLOAD_SUMMARIES_KEY = "isp_intake_upload_summaries_v1";
// Completeness threshold above which the user can manually finalize early.
// The voyage no longer stops based on turn count — see
// docs/voyage-profile-spec.md.
const VOYAGE_EARLY_FINALIZE_THRESHOLD = 0.6;

type Phase =
    | "boot"
    | "sailing"
    | "arrived"
    | "submitting"
    | "done"
    | "error";

interface StoredUpload {
    readonly fileName: string;
    readonly summary: {
        readonly doc_kind: string;
        readonly about_applicant: boolean;
        readonly title: string;
        readonly key_points: ReadonlyArray<string>;
        readonly applicant_summary?: string;
    };
    readonly llmUsed: boolean;
}

function readSession<T>(key: string): T | undefined {
    if (typeof window === "undefined") return undefined;
    try {
        const raw = window.sessionStorage.getItem(key);
        if (!raw) return undefined;
        return JSON.parse(raw) as T;
    } catch {
        return undefined;
    }
}

function writeSession(key: string, value: unknown) {
    if (typeof window === "undefined") return;
    try {
        window.sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
        // ignore quota
    }
}

// Deep-merge two VoyageProfiles. Arrays are unioned (by JSON identity for
// objects, by value for primitives) so the model can incrementally extend
// lists without us losing earlier entries.
function mergeVoyage(
    base: VoyageProfile,
    patch: VoyageProfile,
): VoyageProfile {
    return mergeAny(base, patch) as VoyageProfile;
}

function mergeAny(base: unknown, patch: unknown): unknown {
    if (patch === undefined || patch === null) return base;
    if (Array.isArray(patch)) {
        const baseArr = Array.isArray(base) ? base : [];
        const merged = [...baseArr];
        for (const item of patch) {
            const key = typeof item === "object" ? JSON.stringify(item) : item;
            const exists = merged.some((m) => {
                const k2 =
                    typeof m === "object" ? JSON.stringify(m) : m;
                return k2 === key;
            });
            if (!exists) merged.push(item);
        }
        return merged;
    }
    if (
        typeof patch === "object" &&
        typeof base === "object" &&
        base !== null &&
        !Array.isArray(base)
    ) {
        const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
        for (const [k, v] of Object.entries(patch as Record<string, unknown>)) {
            out[k] = mergeAny(out[k], v);
        }
        return out;
    }
    return patch;
}

function landmarkToVisual(
    landmark: string | undefined,
    done: boolean,
): WaypointKind {
    if (done) return "harbor";
    switch (landmark) {
        case "lighthouse":
            return "lighthouse";
        case "continent":
            return "continent";
        case "reef":
            return "reef";
        case "port":
            return "harbor";
        case "island":
        default:
            return "island";
    }
}

type WaypointKind =
    | "island"
    | "lighthouse"
    | "continent"
    | "reef"
    | "harbor";

function buildAssessmentSummary(
    answers: AssessmentAnswers | undefined,
): VoyageAssessmentSummary | undefined {
    if (!answers) return undefined;
    try {
        const scored = scoreAssessment(answers);
        return {
            big_five: scored.big_five as unknown as Record<string, number>,
            interests: undefined,
        };
    } catch {
        return undefined;
    }
}

export function VoyageStage() {
    const [phase, setPhase] = useState<Phase>("boot");
    const [voyageProfile, setVoyageProfile] = useState<VoyageProfile>({});
    const [history, setHistory] = useState<ReadonlyArray<VoyageHistoryTurn>>(
        [],
    );
    const [question, setQuestion] = useState<VoyageQuestion | null>(null);
    const [affirmation, setAffirmation] = useState<string>("");
    const [doneReason, setDoneReason] = useState<string>("");
    const [completeness, setCompleteness] = useState<number>(0);
    const [draft, setDraft] = useState("");
    const [multiSelected, setMultiSelected] = useState<ReadonlyArray<string>>(
        [],
    );
    const [error, setError] = useState<string | null>(null);
    const [, startTransition] = useTransition();
    const assessmentRef = useRef<AssessmentAnswers | undefined>(undefined);
    const uploadsRef = useRef<ReadonlyArray<VoyageUploadContext>>([]);
    const clarifyRef = useRef<ClarifyPatch>({});
    const bootedRef = useRef(false);
    // Hold a stable ref to requestNext so the initial-boot useEffect
    // below can call it without depending on declaration order (the
    // useCallback that owns it is defined further down). React Compiler
    // refuses to optimize when a function is read before its
    // declaration in source order.
    const requestNextRef = useRef<
        ((args: {
            readonly profile: VoyageProfile;
            readonly history: ReadonlyArray<VoyageHistoryTurn>;
        }) => void) | null
    >(null);

    const turnIndex = history.length;
    const visualKind: WaypointKind = useMemo(
        () =>
            phase === "done"
                ? "harbor"
                : landmarkToVisual(question?.landmark, false),
        [phase, question],
    );

    const progress = useMemo(() => {
        if (phase === "done") return 1;
        // Progress is now driven entirely by LLM-reported completeness,
        // which itself is bound to docs/voyage-profile-spec.md dimension
        // coverage. We only floor at 0.04 so the bar visibly seeds on
        // the first turn.
        return Math.max(0.04, Math.min(1, completeness));
    }, [phase, completeness]);

    // Allow the user to stop early once the model believes meaningful
    // coverage exists, OR after at least three concrete answers — whichever
    // happens first. The natural completion happens automatically when the
    // LLM emits done=true (see system prompt stop conditions).
    const canEarlyFinalize =
        turnIndex >= 3 || completeness >= VOYAGE_EARLY_FINALIZE_THRESHOLD;

    // -------- Initial boot --------
    useEffect(() => {
        if (bootedRef.current) return;
        bootedRef.current = true;
        const profile =
            readSession<VoyageProfile>(VOYAGE_PROFILE_KEY) ?? {};
        const hist =
            readSession<VoyageHistoryTurn[]>(VOYAGE_HISTORY_KEY) ?? [];
        const assessment = readSession<AssessmentAnswers>(ASSESSMENT_KEY);
        const clarify = readSession<ClarifyPatch>(INTAKE_PATCH_KEY) ?? {};
        const uploads = readSession<ReadonlyArray<StoredUpload>>(
            UPLOAD_SUMMARIES_KEY,
        );

        assessmentRef.current = assessment;
        clarifyRef.current = clarify;
        uploadsRef.current = (uploads ?? []).map((u) => ({
            fileName: u.fileName,
            doc_kind: u.summary.doc_kind,
            about_applicant: u.summary.about_applicant,
            title: u.summary.title,
            key_points: u.summary.key_points,
            applicant_summary: u.summary.applicant_summary,
        }));

        setVoyageProfile(profile);
        setHistory(hist);

        // Defer one tick so requestNextRef has been assigned by the
        // later effect below (requestNextRef.current = requestNext).
        queueMicrotask(() => {
            requestNextRef.current?.({
                profile,
                history: hist,
            });
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const requestNext = useCallback(
        async (args: {
            readonly profile: VoyageProfile;
            readonly history: ReadonlyArray<VoyageHistoryTurn>;
        }) => {
            setPhase("sailing");
            setError(null);
            try {
                const r = await nextVoyageTurnAction({
                    profile: args.profile,
                    history: args.history,
                    uploads: uploadsRef.current,
                    assessment: buildAssessmentSummary(
                        assessmentRef.current,
                    ),
                    locale: "zh",
                });
                if (!r.ok || !r.turn) {
                    setError(
                        r.error ?? "AI 暂时联系不上，稍后再试。",
                    );
                    setPhase("error");
                    return;
                }

                const t = r.turn;
                const mergedProfile = mergeVoyage(args.profile, t.patch);
                setVoyageProfile(mergedProfile);
                writeSession(VOYAGE_PROFILE_KEY, mergedProfile);
                setCompleteness(t.completeness);
                if (t.affirmation) setAffirmation(t.affirmation);

                if (t.done) {
                    setDoneReason(
                        t.done_reason ?? "已经收集到足够信号，可以靠岸了。",
                    );
                    setQuestion(null);
                    setPhase("done");
                    return;
                }

                if (!t.question) {
                    setError("AI 漏掉了下一题，请重试一次。");
                    setPhase("error");
                    return;
                }

                // Brief sailing delay so the user perceives forward motion
                // even when the LLM was fast.
                await new Promise((resolve) => setTimeout(resolve, 850));
                setQuestion(t.question);
                setDraft("");
                setMultiSelected([]);
                setPhase("arrived");
            } catch (cause) {
                // eslint-disable-next-line no-console
                console.error("[voyage] turn failed", cause);
                setError("AI 暂时联系不上，稍后再试。");
                setPhase("error");
            }
        },
        [],
    );

    // Publish requestNext into the ref so the initial-boot useEffect
    // can reach it without a TDZ violation in source order.
    useEffect(() => {
        requestNextRef.current = requestNext;
    }, [requestNext]);

    const submitAnswer = useCallback(
        (raw: string) => {
            const trimmed = raw.trim();
            if (!trimmed || !question) return;
            const turn: VoyageHistoryTurn = {
                question: question.prompt,
                answer: trimmed,
                topic: question.topic,
            };
            const nextHistory: VoyageHistoryTurn[] = [...history, turn];
            setHistory(nextHistory);
            writeSession(VOYAGE_HISTORY_KEY, nextHistory);
            setPhase("submitting");
            trackEvent("intake_step_start", {
                channel: "chat",
                step: turnIndex + 1,
            });
            startTransition(() => {
                void requestNext({
                    profile: voyageProfile,
                    history: nextHistory,
                });
            });
        },
        [question, history, voyageProfile, turnIndex, requestNext],
    );

    const finalizeNow = useCallback(() => {
        startTransition(async () => {
            try {
                // Project the rich voyage profile down into ClarifyPatch
                // overlays and merge with whatever the chat / form path
                // already captured. Never overwrite an existing value.
                const overlay = projectVoyageToClarifyPatch(
                    voyageProfile,
                    clarifyRef.current,
                );
                const merged = mergePatchDeep(
                    clarifyRef.current,
                    overlay,
                );
                writeSession(INTAKE_PATCH_KEY, merged);
                await finalizeChatIntakeAction(
                    merged,
                    assessmentRef.current,
                );
            } catch (cause) {
                // finalizeChatIntakeAction redirects on success; only logs
                // here on genuine failure.
                // eslint-disable-next-line no-console
                console.error("[voyage] finalize failed", cause);
                setError("生成推荐失败，稍后再试。");
            }
        });
    }, [voyageProfile]);

    const skipToReco = useCallback(() => {
        finalizeNow();
    }, [finalizeNow]);

    // ------ Rendering ------
    return (
        <div className="voyage" aria-label="留学方向细化航行">
            {/* Sky + sun */}
            <div className="sky" aria-hidden>
                <div className="sun" />
                <div className="clouds clouds-1" />
                <div className="clouds clouds-2" />
            </div>

            {/* Horizon glow line */}
            <div className="horizon" aria-hidden />

            {/* Sea perspective grid */}
            <div className="sea" aria-hidden>
                <div className="sea-grid" />
                <div className="sea-shimmer" />
                <div className="sun-lane" />
                <div className="wave-band wave-band--far" />
                <div className="wave-band wave-band--mid" />
                <div className="wave-band wave-band--near" />
                <div className="wave-layer wave-layer--back" />
                <div className="wave-layer wave-layer--mid" />
                <div className="wave-layer wave-layer--front" />
                <div className="crest crest--a" />
                <div className="crest crest--b" />
                <div className="crest crest--c" />
                <div className="wake-v" />
                <div className="wake-foam" />
            </div>

            {/* Floating waypoint silhouette. The key intentionally omits
                turnIndex so the element does NOT remount the moment the
                user submits an answer; that lets the submitting→sailing
                CSS transition actually play instead of the node being
                torn down and replaced. The element only remounts when
                the landmark visual kind genuinely changes. */}
            <div
                className={`waypoint waypoint--${phase} waypoint--${visualKind}`}
                key={visualKind}
                aria-hidden
            >
                <WaypointSvg kind={visualKind} />
            </div>

            {/* Top-right voyage progress */}
            <div className="hud-progress" aria-label="航行进度">
                <div className="hud-progress__label">
                    {phase === "done"
                        ? "靠岸"
                        : `航点 ${turnIndex + (phase === "arrived" || phase === "submitting" ? 1 : 0)} · ${Math.round(progress * 100)}%`}
                </div>
                <div className="hud-progress__bar">
                    <div
                        className="hud-progress__fill"
                        style={{ width: `${Math.round(progress * 100)}%` }}
                    />
                    <div
                        className="hud-progress__ship"
                        style={{ left: `${Math.round(progress * 100)}%` }}
                        aria-hidden
                    >
                        <ShipIcon />
                    </div>
                </div>
            </div>

            {/* Top-left exit */}
            <button
                type="button"
                className="hud-skip"
                onClick={skipToReco}
                disabled={!canEarlyFinalize}
                title={
                    canEarlyFinalize
                        ? "用现在的信息直接生成推荐，也可以继续答下去"
                        : "再多答几题就能就近靠岸"
                }
            >
                {canEarlyFinalize ? "就近靠岸 · 查看结果" : "继续航行中…"}
            </button>

            {/* Third-person chase view: a small sailboat ahead and below,
                viewed from above-and-behind */}
            <div className={`chase-boat chase-boat--${phase}`} aria-hidden>
                <svg viewBox="0 0 240 220">
                    <defs>
                        <linearGradient
                            id="hull-grad"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                        >
                            <stop offset="0%" stopColor="#c08a55" />
                            <stop offset="35%" stopColor="#8e5a30" />
                            <stop offset="100%" stopColor="#2a1208" />
                        </linearGradient>
                        <linearGradient
                            id="deck-grad"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                        >
                            <stop offset="0%" stopColor="#f1c08a" />
                            <stop offset="100%" stopColor="#8e5a30" />
                        </linearGradient>
                        <linearGradient
                            id="sail-grad"
                            x1="0"
                            y1="0"
                            x2="1"
                            y2="0"
                        >
                            <stop offset="0%" stopColor="#fff8e8" />
                            <stop offset="100%" stopColor="#f1c08a" />
                        </linearGradient>
                        <linearGradient
                            id="sail-shadow"
                            x1="1"
                            y1="0"
                            x2="0"
                            y2="0"
                        >
                            <stop offset="0%" stopColor="#000" stopOpacity="0.18" />
                            <stop offset="100%" stopColor="#000" stopOpacity="0" />
                        </linearGradient>
                    </defs>

                    {/* Stern foam crescent + spray */}
                    <ellipse
                        cx="120"
                        cy="178"
                        rx="92"
                        ry="8"
                        fill="#fff8e8"
                        opacity="0.55"
                    />
                    <ellipse
                        cx="120"
                        cy="184"
                        rx="60"
                        ry="4"
                        fill="#fff8e8"
                        opacity="0.85"
                    />
                    <circle cx="58" cy="172" r="2" fill="#fff8e8" />
                    <circle cx="186" cy="172" r="2" fill="#fff8e8" />
                    <circle cx="80" cy="180" r="1.5" fill="#fff8e8" />
                    <circle cx="166" cy="180" r="1.5" fill="#fff8e8" />

                    {/* Hull seen from rear-above */}
                    <path
                        d="M68 122
                           Q120 110 172 122
                           L192 172
                           Q120 184 48 172 Z"
                        fill="url(#hull-grad)"
                    />
                    {/* Hull keel shadow */}
                    <path
                        d="M70 158 Q120 168 170 158 L172 170 Q120 178 68 170 Z"
                        fill="#000"
                        opacity="0.25"
                    />
                    {/* Deck */}
                    <path
                        d="M76 124 Q120 116 164 124 L160 138 Q120 132 80 138 Z"
                        fill="url(#deck-grad)"
                    />
                    {/* Deck planks */}
                    {[0, 1, 2, 3, 4].map((i) => (
                        <line
                            key={i}
                            x1={86 + i * 14}
                            y1="124"
                            x2={86 + i * 14}
                            y2="136"
                            stroke="#5e2a18"
                            strokeWidth="0.8"
                            opacity="0.55"
                        />
                    ))}
                    {/* Stern transom panel */}
                    <path
                        d="M82 162 Q120 170 158 162 L156 172 Q120 178 84 172 Z"
                        fill="#5e2a18"
                    />
                    {/* Cabin / hatch */}
                    <rect
                        x="108"
                        y="116"
                        width="24"
                        height="14"
                        rx="3"
                        fill="#3c1a0d"
                    />
                    <rect
                        x="111"
                        y="119"
                        width="18"
                        height="6"
                        rx="1.5"
                        fill="#ffd089"
                        opacity="0.85"
                    />
                    {/* Life ring on the port rail */}
                    <circle cx="86" cy="130" r="4" fill="#fff8e8" />
                    <circle cx="86" cy="130" r="2" fill="#d24a2a" />
                    {/* Rails */}
                    <path
                        d="M74 124 Q120 114 166 124"
                        stroke="#3c1a0d"
                        strokeWidth="1.2"
                        fill="none"
                    />

                    {/* Mast */}
                    <rect
                        x="118.5"
                        y="22"
                        width="3"
                        height="100"
                        fill="#3c1a0d"
                    />
                    {/* Boom */}
                    <rect
                        x="120"
                        y="108"
                        width="44"
                        height="3"
                        fill="#3c1a0d"
                    />
                    {/* Mainsail (billowing right) */}
                    <path
                        d="M120 24
                           Q162 64 160 110
                           L122 110 Z"
                        fill="url(#sail-grad)"
                        stroke="#a06a3d"
                        strokeWidth="0.6"
                    />
                    {/* Mainsail seams */}
                    <path
                        d="M122 46 Q146 50 148 56"
                        stroke="#a06a3d"
                        strokeWidth="0.6"
                        fill="none"
                        opacity="0.7"
                    />
                    <path
                        d="M122 68 Q150 70 154 80"
                        stroke="#a06a3d"
                        strokeWidth="0.6"
                        fill="none"
                        opacity="0.7"
                    />
                    <path
                        d="M122 90 Q150 92 156 100"
                        stroke="#a06a3d"
                        strokeWidth="0.6"
                        fill="none"
                        opacity="0.7"
                    />
                    {/* Mainsail leeward shadow */}
                    <path
                        d="M120 24 Q162 64 160 110 L122 110 Z"
                        fill="url(#sail-shadow)"
                    />
                    {/* Jib (forestay sail, smaller, on left) */}
                    <path
                        d="M120 36
                           Q90 70 96 108
                           L120 108 Z"
                        fill="#fff8e8"
                        opacity="0.95"
                        stroke="#a06a3d"
                        strokeWidth="0.5"
                    />
                    {/* Forestay & shrouds */}
                    <line x1="120" y1="22" x2="96" y2="108" stroke="#3c1a0d" strokeWidth="0.6" />
                    <line x1="120" y1="22" x2="76" y2="124" stroke="#3c1a0d" strokeWidth="0.5" opacity="0.7" />
                    <line x1="120" y1="22" x2="164" y2="124" stroke="#3c1a0d" strokeWidth="0.5" opacity="0.7" />
                    {/* Flag at masthead */}
                    <path
                        d="M122 22 L138 26 L132 30 L138 34 L122 30 Z"
                        fill="#d24a2a"
                    />
                </svg>
            </div>

            {/* Bottom dialog */}
            <div className="dialog-frame" aria-live="polite">
                {(phase === "arrived" || phase === "submitting") &&
                    question ? (
                    <div
                        className={`dialog ${phase === "submitting" ? "dialog--busy" : ""}`}
                    >
                        <div className="dialog__title">
                            <div className="dialog__avatar" aria-hidden>
                                AI
                            </div>
                            <div>
                                <div className="dialog__name">
                                    {visualKind === "lighthouse"
                                        ? "灯塔守望者"
                                        : visualKind === "continent"
                                            ? "大陆瞭望员"
                                            : visualKind === "reef"
                                                ? "暗礁警戒员"
                                                : "前方的小岛"}
                                </div>
                                <div className="dialog__hint">
                                    {question.topic} · 回答后继续前行
                                </div>
                            </div>
                        </div>
                        {affirmation && turnIndex > 0 ? (
                            <div className="affirmation">
                                <span aria-hidden>·</span> {affirmation}
                            </div>
                        ) : null}
                        <p className="dialog__text">{question.prompt}</p>
                        {question.rationale ? (
                            <p className="dialog__rationale">
                                {question.rationale}
                            </p>
                        ) : null}

                        <QuestionInput
                            question={question}
                            draft={draft}
                            onDraftChange={setDraft}
                            multiSelected={multiSelected}
                            onMultiToggle={(v) =>
                                setMultiSelected((prev) =>
                                    prev.includes(v)
                                        ? prev.filter((x) => x !== v)
                                        : [...prev, v],
                                )
                            }
                            onSubmit={submitAnswer}
                            busy={phase === "submitting"}
                        />
                    </div>
                ) : null}

                {phase === "sailing" || phase === "boot" ? (
                    <div className="dialog dialog--ghost">
                        <SailingIndicator
                            label={
                                phase === "boot"
                                    ? "扬帆出海…"
                                    : "向前航行…"
                            }
                        />
                    </div>
                ) : null}

                {phase === "done" ? (
                    <div className="dialog">
                        <div className="dialog__title">
                            <div className="dialog__avatar" aria-hidden>
                                港
                            </div>
                            <div>
                                <div className="dialog__name">靠岸</div>
                                <div className="dialog__hint">
                                    AI 已经把脉到位
                                </div>
                            </div>
                        </div>
                        <p className="dialog__text">
                            {doneReason ||
                                "信息够了，给你拉推荐去。"}
                        </p>
                        <div className="dialog__cta">
                            <button
                                type="button"
                                className="cta-primary"
                                onClick={finalizeNow}
                            >
                                查看我的推荐
                            </button>
                        </div>
                    </div>
                ) : null}

                {phase === "error" ? (
                    <div className="dialog">
                        <p className="dialog__text">
                            {error ?? "AI 暂时联系不上。"}
                        </p>
                        <div className="dialog__cta">
                            <button
                                type="button"
                                className="cta-primary"
                                onClick={() =>
                                    void requestNext({
                                        profile: voyageProfile,
                                        history,
                                    })
                                }
                            >
                                重试
                            </button>
                        </div>
                    </div>
                ) : null}
            </div>

            <style jsx>{`
                .voyage {
                    position: fixed;
                    inset: 0;
                    overflow: hidden;
                    background: linear-gradient(
                        180deg,
                        #fff4e3 0%,
                        #fde2c0 22%,
                        #f9c79c 38%,
                        #f3a577 48%,
                        #d97a4e 60%
                    );
                    color: var(--color-text);
                    font-family: inherit;
                    perspective: 900px;
                }
                .sky {
                    position: absolute;
                    inset: 0 0 50% 0;
                    overflow: hidden;
                }
                .sun {
                    position: absolute;
                    bottom: -12%;
                    left: 50%;
                    width: 240px;
                    height: 240px;
                    transform: translateX(-50%);
                    border-radius: 50%;
                    background: radial-gradient(
                        circle,
                        #fff7e0 0%,
                        #ffd189 38%,
                        rgba(255, 209, 137, 0) 70%
                    );
                    filter: blur(2px);
                }
                .clouds {
                    position: absolute;
                    top: 18%;
                    width: 220%;
                    height: 14%;
                    background:
                        radial-gradient(
                            closest-side at 20% 60%,
                            rgba(255, 255, 255, 0.55) 0%,
                            rgba(255, 255, 255, 0) 70%
                        ),
                        radial-gradient(
                            closest-side at 55% 30%,
                            rgba(255, 255, 255, 0.45) 0%,
                            rgba(255, 255, 255, 0) 70%
                        ),
                        radial-gradient(
                            closest-side at 82% 50%,
                            rgba(255, 255, 255, 0.5) 0%,
                            rgba(255, 255, 255, 0) 70%
                        );
                }
                .clouds-1 {
                    animation: cloud-drift 90s linear infinite;
                }
                .clouds-2 {
                    top: 32%;
                    opacity: 0.55;
                    animation: cloud-drift 140s linear infinite reverse;
                }
                @keyframes cloud-drift {
                    from {
                        transform: translateX(-30%);
                    }
                    to {
                        transform: translateX(0%);
                    }
                }

                .horizon {
                    position: absolute;
                    top: 50%;
                    left: 0;
                    right: 0;
                    height: 2px;
                    background: linear-gradient(
                        90deg,
                        rgba(255, 240, 200, 0) 0%,
                        rgba(255, 240, 200, 0.7) 50%,
                        rgba(255, 240, 200, 0) 100%
                    );
                    box-shadow: 0 0 18px rgba(255, 230, 170, 0.6);
                }

                .sea {
                    position: absolute;
                    inset: 50% 0 0 0;
                    overflow: hidden;
                    perspective: 720px;
                    perspective-origin: 50% 0%;
                }
                .sea-grid {
                    position: absolute;
                    left: -25%;
                    right: -25%;
                    top: 0;
                    height: 220%;
                    background:
                        radial-gradient(
                            ellipse 80% 40% at 50% 0%,
                            rgba(255, 200, 140, 0.55) 0%,
                            rgba(255, 200, 140, 0) 60%
                        ),
                        linear-gradient(
                            180deg,
                            #4a7fa3 0%,
                            #2d5b80 38%,
                            #1c3f5e 72%,
                            #122d44 100%
                        );
                    transform-origin: 50% 0%;
                    transform: rotateX(64deg);
                    animation: none;
                }
                @keyframes sea-pan {
                    from {
                        background-position: 0 0;
                    }
                    to {
                        background-position: 0 96px;
                    }
                }
                .sea-shimmer {
                    position: absolute;
                    inset: 0;
                    background: radial-gradient(
                        ellipse at 50% 0%,
                        rgba(255, 250, 230, 0.35) 0%,
                        rgba(255, 250, 230, 0) 55%
                    );
                    pointer-events: none;
                }

                /* Sun reflection lane: vertical column of light from the
                   horizon directly under the sun stretching toward the
                   viewer. Animated brightness gives the impression the sea
                   surface is dancing under the sun. */
                .sun-lane {
                    position: absolute;
                    left: 50%;
                    top: 0;
                    width: 26%;
                    height: 100%;
                    transform: translateX(-50%);
                    background: radial-gradient(
                        ellipse at 50% 0%,
                        rgba(255, 245, 210, 0.7) 0%,
                        rgba(255, 220, 160, 0.35) 24%,
                        rgba(255, 200, 120, 0.18) 50%,
                        rgba(255, 200, 120, 0) 80%
                    );
                    mix-blend-mode: screen;
                    animation: lane-pulse 5s ease-in-out infinite;
                    pointer-events: none;
                }
                @keyframes lane-pulse {
                    0%,
                    100% {
                        opacity: 0.85;
                        transform: translateX(-50%) scaleY(1);
                    }
                    50% {
                        opacity: 1;
                        transform: translateX(-50%) scaleY(1.06);
                    }
                }

                /* Horizontal wave bands at three depths. Each undulates at
                   slightly different speed/amplitude to break the flat
                   perspective-grid look and give the sea real motion. */
                .wave-band {
                    position: absolute;
                    left: -10%;
                    right: -10%;
                    height: 14px;
                    background: linear-gradient(
                        90deg,
                        rgba(255, 240, 200, 0) 0%,
                        rgba(255, 240, 200, 0.45) 30%,
                        rgba(255, 240, 200, 0.7) 50%,
                        rgba(255, 240, 200, 0.45) 70%,
                        rgba(255, 240, 200, 0) 100%
                    );
                    border-radius: 50%;
                    filter: blur(2px);
                    pointer-events: none;
                }
                .wave-band--far {
                    top: 6%;
                    height: 6px;
                    opacity: 0.55;
                    animation: wave-sway 6s ease-in-out infinite;
                }
                .wave-band--mid {
                    top: 22%;
                    height: 10px;
                    opacity: 0.7;
                    animation: wave-sway 4.4s ease-in-out infinite reverse;
                }
                .wave-band--near {
                    top: 48%;
                    height: 18px;
                    opacity: 0.8;
                    animation: wave-sway 3.1s ease-in-out infinite;
                }
                @keyframes wave-sway {
                    0%,
                    100% {
                        transform: translateX(-4%) scaleY(1);
                    }
                    50% {
                        transform: translateX(4%) scaleY(1.15);
                    }
                }

                /* Animated SVG wave layers tiled horizontally. Three
                   stacked layers at increasing y-offset move at different
                   speeds to convey depth — back layer slow, front layer
                   faster — and each one is a repeating wave path encoded
                   inline as a data URI. */
                .wave-layer {
                    position: absolute;
                    left: -50%;
                    right: -50%;
                    height: 60px;
                    background-repeat: repeat-x;
                    background-size: 220px 60px;
                    pointer-events: none;
                }
                .wave-layer--back {
                    top: 14%;
                    height: 30px;
                    background-size: 260px 30px;
                    opacity: 0.45;
                    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 260 30' preserveAspectRatio='none'><path d='M0 18 Q32 6 65 18 T130 18 T195 18 T260 18 V30 H0 Z' fill='%23ffffff' opacity='0.55'/></svg>");
                    animation: wave-shift 18s linear infinite;
                }
                .wave-layer--mid {
                    top: 34%;
                    height: 46px;
                    background-size: 220px 46px;
                    opacity: 0.6;
                    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 220 46' preserveAspectRatio='none'><path d='M0 28 Q28 8 55 28 T110 28 T165 28 T220 28 V46 H0 Z' fill='%23ffffff' opacity='0.6'/></svg>");
                    animation: wave-shift 11s linear infinite reverse;
                }
                .wave-layer--front {
                    top: 58%;
                    height: 70px;
                    background-size: 180px 70px;
                    opacity: 0.75;
                    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 180 70' preserveAspectRatio='none'><path d='M0 40 Q22 12 45 40 T90 40 T135 40 T180 40 V70 H0 Z' fill='%23ffffff' opacity='0.7'/></svg>");
                    animation: wave-shift 7s linear infinite;
                }
                @keyframes wave-shift {
                    from {
                        background-position-x: 0;
                    }
                    to {
                        background-position-x: -440px;
                    }
                }

                /* Drifting foam crest patches — small white blobs that
                   slowly travel across the surface and fade in/out, like
                   wind-blown whitecaps. */
                .crest {
                    position: absolute;
                    width: 80px;
                    height: 8px;
                    border-radius: 50%;
                    background: radial-gradient(
                        ellipse at 50% 50%,
                        rgba(255, 255, 255, 0.9) 0%,
                        rgba(255, 255, 255, 0) 70%
                    );
                    filter: blur(1px);
                    opacity: 0;
                    pointer-events: none;
                }
                .crest--a {
                    top: 28%;
                    animation: crest-drift 9s linear infinite;
                }
                .crest--b {
                    top: 46%;
                    width: 110px;
                    height: 10px;
                    animation: crest-drift 7s linear infinite;
                    animation-delay: -3s;
                }
                .crest--c {
                    top: 64%;
                    width: 140px;
                    height: 12px;
                    animation: crest-drift 5.5s linear infinite;
                    animation-delay: -1.5s;
                }
                @keyframes crest-drift {
                    0% {
                        left: -10%;
                        opacity: 0;
                    }
                    20% {
                        opacity: 0.85;
                    }
                    80% {
                        opacity: 0.85;
                    }
                    100% {
                        left: 110%;
                        opacity: 0;
                    }
                }

                /* V-shaped boat wake: two diverging white streaks coming
                   straight at the viewer from the horizon. Implemented as
                   two thin gradients, rotated, anchored at the screen
                   center-bottom. */
                .wake-v {
                    position: absolute;
                    left: 50%;
                    bottom: -10%;
                    width: 4px;
                    height: 80%;
                    transform: translateX(-50%);
                    background: linear-gradient(
                        180deg,
                        rgba(255, 250, 230, 0) 0%,
                        rgba(255, 250, 230, 0.55) 60%,
                        rgba(255, 250, 230, 0.85) 100%
                    );
                    box-shadow:
                        -20px 0 22px rgba(255, 250, 230, 0.5),
                        20px 0 22px rgba(255, 250, 230, 0.5);
                    filter: blur(1px);
                    pointer-events: none;
                }
                .wake-v::before,
                .wake-v::after {
                    content: "";
                    position: absolute;
                    bottom: 0;
                    width: 3px;
                    height: 70%;
                    background: linear-gradient(
                        180deg,
                        rgba(255, 250, 230, 0) 0%,
                        rgba(255, 250, 230, 0.65) 70%,
                        rgba(255, 250, 230, 0.9) 100%
                    );
                    filter: blur(1.5px);
                }
                .wake-v::before {
                    left: -40px;
                    transform: rotate(-14deg);
                    transform-origin: bottom right;
                }
                .wake-v::after {
                    right: -40px;
                    transform: rotate(14deg);
                    transform-origin: bottom left;
                }
                .wake-foam {
                    position: absolute;
                    left: 50%;
                    bottom: -6%;
                    width: 60%;
                    height: 14%;
                    transform: translateX(-50%);
                    background: radial-gradient(
                        ellipse at 50% 100%,
                        rgba(255, 250, 230, 0.7) 0%,
                        rgba(255, 250, 230, 0.25) 35%,
                        rgba(255, 250, 230, 0) 70%
                    );
                    filter: blur(2px);
                    animation: foam-pulse 2.6s ease-in-out infinite;
                    pointer-events: none;
                }
                @keyframes foam-pulse {
                    0%,
                    100% {
                        opacity: 0.7;
                        transform: translateX(-50%) scaleX(1);
                    }
                    50% {
                        opacity: 1;
                        transform: translateX(-50%) scaleX(1.08);
                    }
                }

                /* Third-person chase boat: a small sailboat sitting just
                   below center-screen, viewed from rear-above. Gently
                   bobs to suggest forward sailing. */
                .chase-boat {
                    position: absolute;
                    left: 50%;
                    bottom: 28%;
                    width: 170px;
                    height: 142px;
                    transform: translateX(-50%);
                    pointer-events: none;
                    filter: drop-shadow(0 8px 14px rgba(0, 0, 0, 0.35));
                    animation: boat-bob 4.2s ease-in-out infinite;
                    z-index: 3;
                }
                .chase-boat svg {
                    width: 100%;
                    height: 100%;
                    display: block;
                }
                @keyframes boat-bob {
                    0%,
                    100% {
                        transform: translate(-50%, 0) rotate(-1deg);
                    }
                    50% {
                        transform: translate(-50%, -4px) rotate(1deg);
                    }
                }
                /* When the user has just submitted an answer, the boat
                   steers around the waypoint (which slides off to the
                   starboard side) and then settles back to a forward
                   heading. We swap the gentle bob animation for a
                   one-shot turn-and-return arc. */
                .chase-boat--submitting {
                    animation: boat-turn 1s cubic-bezier(0.45, 0, 0.25, 1)
                        forwards;
                }
                .chase-boat--sailing,
                .chase-boat--arrived,
                .chase-boat--boot,
                .chase-boat--done,
                .chase-boat--error {
                    animation: boat-bob 4.2s ease-in-out infinite;
                }
                @keyframes boat-turn {
                    0% {
                        transform: translate(-50%, 0) rotate(0deg);
                    }
                    35% {
                        transform: translate(-22%, -3px) rotate(18deg);
                    }
                    70% {
                        transform: translate(-42%, -1px) rotate(5deg);
                    }
                    100% {
                        transform: translate(-50%, 0) rotate(0deg);
                    }
                }

                .waypoint {
                    position: absolute;
                    left: 50%;
                    top: 38%;
                    width: 220px;
                    height: 200px;
                    transform: translate(-50%, -50%) scale(0.18);
                    opacity: 0;
                    pointer-events: none;
                    filter: drop-shadow(0 14px 30px rgba(120, 50, 20, 0.45));
                    transition:
                        transform 1.1s cubic-bezier(0.2, 0.7, 0.2, 1),
                        opacity 1.1s ease;
                }
                .waypoint--sailing {
                    transform: translate(-50%, -50%) scale(0.22);
                    opacity: 0;
                }
                .waypoint--arrived {
                    transform: translate(-50%, -10%) scale(1);
                    opacity: 1;
                }
                /* On submit the waypoint glides sideways along the
                   horizon and shrinks into the distance while the boat
                   banks to the opposite side and straightens back out.
                   Vertical position stays anchored so the silhouette
                   never floats up into the sky. */
                .waypoint--submitting {
                    transform: translate(-200%, -50%) scale(0.28);
                    opacity: 0;
                    transition:
                        transform 1.1s cubic-bezier(0.32, 0.04, 0.4, 1),
                        opacity 0.9s ease-in 0.2s;
                }
                .waypoint--done {
                    transform: translate(-50%, -10%) scale(1.05);
                    opacity: 1;
                }

                .hud-progress {
                    position: absolute;
                    top: 22px;
                    right: 24px;
                    width: 230px;
                    padding: 10px 14px;
                    border-radius: 14px;
                    background: rgba(255, 244, 220, 0.78);
                    backdrop-filter: blur(8px);
                    box-shadow: 0 4px 18px rgba(120, 50, 20, 0.22);
                    color: #5a2a10;
                    font-size: 12px;
                    font-weight: 600;
                    user-select: none;
                }
                .hud-progress__label {
                    margin-bottom: 6px;
                    letter-spacing: 0.06em;
                    color: #4a1f0a;
                    text-shadow: 0 1px 0 rgba(255, 255, 255, 0.55);
                }
                .hud-progress__bar {
                    position: relative;
                    height: 8px;
                    border-radius: 999px;
                    background: rgba(120, 70, 30, 0.18);
                    overflow: visible;
                }
                .hud-progress__fill {
                    position: absolute;
                    inset: 0 auto 0 0;
                    border-radius: 999px;
                    background: linear-gradient(
                        90deg,
                        #fff3d4 0%,
                        #ffd089 50%,
                        #ff8c45 100%
                    );
                    transition: width 0.6s ease;
                }
                .hud-progress__ship {
                    position: absolute;
                    top: 50%;
                    transform: translate(-50%, -55%);
                    color: #4a1f0a;
                    filter: drop-shadow(0 1px 2px rgba(255, 255, 255, 0.5));
                    transition: left 0.6s ease;
                }

                .hud-skip {
                    position: absolute;
                    top: 22px;
                    left: 24px;
                    padding: 8px 14px;
                    border-radius: 999px;
                    background: rgba(255, 244, 220, 0.82);
                    color: #4a1f0a;
                    font-size: 12px;
                    font-weight: 600;
                    backdrop-filter: blur(8px);
                    border: 1px solid rgba(120, 70, 30, 0.25);
                    cursor: pointer;
                    box-shadow: 0 4px 14px rgba(120, 50, 20, 0.18);
                    transition:
                        background 0.2s ease,
                        box-shadow 0.2s ease,
                        transform 0.15s ease;
                }
                .hud-skip:not(:disabled) {
                    background: linear-gradient(
                        135deg,
                        #ffd089 0%,
                        #ff9a55 100%
                    );
                    color: #3a1606;
                    border-color: rgba(255, 154, 85, 0.6);
                    box-shadow: 0 6px 18px rgba(255, 130, 60, 0.32);
                }
                .hud-skip:hover:not(:disabled) {
                    transform: translateY(-1px);
                    box-shadow: 0 8px 22px rgba(255, 130, 60, 0.4);
                }
                .hud-skip:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                    transform: none;
                }

                .dialog-frame {
                    position: absolute;
                    left: 50%;
                    bottom: 36px;
                    transform: translateX(-50%);
                    width: min(560px, calc(100vw - 32px));
                    z-index: 5;
                }
                .dialog {
                    background: rgba(255, 248, 235, 0.92);
                    backdrop-filter: blur(14px);
                    border-radius: 22px;
                    padding: 18px 20px 16px;
                    box-shadow:
                        0 16px 40px rgba(120, 50, 20, 0.28),
                        inset 0 0 0 1px rgba(255, 255, 255, 0.5);
                    animation: dialog-rise 0.55s cubic-bezier(0.2, 0.8, 0.2, 1);
                }
                .dialog--busy {
                    opacity: 0.7;
                }
                .dialog--ghost {
                    background: rgba(255, 248, 235, 0.6);
                    text-align: center;
                }
                @keyframes dialog-rise {
                    from {
                        transform: translateY(20px);
                        opacity: 0;
                    }
                    to {
                        transform: translateY(0);
                        opacity: 1;
                    }
                }
                .dialog__title {
                    display: flex;
                    gap: 10px;
                    align-items: center;
                    margin-bottom: 8px;
                }
                .dialog__avatar {
                    width: 30px;
                    height: 30px;
                    border-radius: 50%;
                    display: grid;
                    place-items: center;
                    background: var(--gradient-primary);
                    color: var(--color-text-on-primary);
                    font-size: 12px;
                    font-weight: 600;
                }
                .dialog__name {
                    font-size: 13px;
                    font-weight: 600;
                    color: var(--color-text);
                }
                .dialog__hint {
                    font-size: 11px;
                    color: var(--color-text-muted);
                }
                .dialog__text {
                    color: var(--color-text);
                    font-size: 15px;
                    line-height: 1.55;
                    margin: 6px 0 14px;
                }
                .dialog__rationale {
                    color: var(--color-text-muted);
                    font-size: 12px;
                    line-height: 1.5;
                    margin: -8px 0 12px;
                    font-style: italic;
                }
                .affirmation {
                    font-size: 12px;
                    color: var(--color-text-muted);
                    background: color-mix(
                        in srgb,
                        var(--color-primary-from) 10%,
                        transparent
                    );
                    border-left: 2px solid
                        color-mix(
                            in srgb,
                            var(--color-primary-from) 60%,
                            transparent
                        );
                    padding: 6px 10px;
                    border-radius: 6px;
                    margin: 4px 0 10px;
                }
                .dialog__cta {
                    display: flex;
                    justify-content: flex-end;
                    margin-top: 10px;
                }
                .cta-primary {
                    padding: 10px 18px;
                    border-radius: 999px;
                    background: var(--gradient-primary);
                    color: var(--color-text-on-primary);
                    font-weight: 600;
                    box-shadow: var(--shadow-clay-primary);
                    cursor: pointer;
                    transition: transform 0.15s ease;
                }
                .cta-primary:hover {
                    transform: translateY(-1px);
                }

                @media (prefers-reduced-motion: reduce) {
                    .clouds,
                    .sea-grid,
                    .waypoint,
                    .sun-lane,
                    .wave-band,
                    .wave-layer,
                    .crest,
                    .wake-foam,
                    .chase-boat {
                        animation: none !important;
                        transition: none !important;
                    }
                }
            `}</style>
        </div>
    );
}

// ----------------- Sub-components -----------------

function QuestionInput({
    question,
    draft,
    onDraftChange,
    multiSelected,
    onMultiToggle,
    onSubmit,
    busy,
}: {
    readonly question: VoyageQuestion;
    readonly draft: string;
    readonly onDraftChange: (s: string) => void;
    readonly multiSelected: ReadonlyArray<string>;
    readonly onMultiToggle: (v: string) => void;
    readonly onSubmit: (raw: string) => void;
    readonly busy: boolean;
}) {
    const options = question.options ?? [];
    const labelByValue = new Map(
        options.map((o) => [o.value, o.label] as const),
    );

    if (question.kind === "choice") {
        return (
            <SingleInput
                draft={draft}
                onChange={onDraftChange}
                onSubmit={() => {
                    if (!draft.trim()) return;
                    onSubmit(draft.trim());
                }}
                quickReplies={options.map((o) => o.label)}
                onPick={(label) => {
                    const opt = options.find((o) => o.label === label);
                    onSubmit(opt ? opt.value : label);
                }}
                placeholder={question.placeholder ?? "也可以直接写你的回答…"}
                busy={busy}
            />
        );
    }

    if (question.kind === "multi") {
        return (
            <MultiChipsInput
                options={options.map((o) => o.label)}
                selected={multiSelected.map(
                    (v) => labelByValue.get(v) ?? v,
                )}
                onToggle={(label) => {
                    const opt = options.find((o) => o.label === label);
                    onMultiToggle(opt ? opt.value : label);
                }}
                onSubmit={(extras) => {
                    const extraList = extras
                        .split(/[,，、]/)
                        .map((s) => s.trim())
                        .filter(Boolean);
                    const all = [...multiSelected, ...extraList];
                    if (all.length === 0) return;
                    onSubmit(all.join(","));
                }}
                busy={busy}
            />
        );
    }

    if (question.kind === "scale") {
        return (
            <ScaleInput
                options={options}
                onPick={(value) => onSubmit(value)}
                busy={busy}
            />
        );
    }

    if (question.kind === "number") {
        return (
            <NumberInput
                placeholder={question.placeholder ?? "输入一个数字"}
                draft={draft}
                onChange={onDraftChange}
                onSubmit={() => {
                    if (!draft.trim()) return;
                    onSubmit(draft.trim());
                }}
                quickReplies={options.map((o) => o.label)}
                busy={busy}
            />
        );
    }

    // free
    return (
        <SingleInput
            draft={draft}
            onChange={onDraftChange}
            onSubmit={() => {
                if (!draft.trim()) return;
                onSubmit(draft.trim());
            }}
            quickReplies={options.map((o) => o.label)}
            onPick={(label) => {
                const opt = options.find((o) => o.label === label);
                onSubmit(opt ? opt.value : label);
            }}
            placeholder={question.placeholder ?? "用一两句话说说…"}
            busy={busy}
        />
    );
}

function ScaleInput({
    options,
    onPick,
    busy,
}: {
    readonly options: ReadonlyArray<{ label: string; value: string }>;
    readonly onPick: (value: string) => void;
    readonly busy: boolean;
}) {
    // 5-button Likert. If LLM supplied options use them, otherwise fall
    // back to a generic -2..+2 scale with neutral labels.
    const fallback: ReadonlyArray<{ label: string; value: string }> = [
        { label: "完全不", value: "-2" },
        { label: "不太", value: "-1" },
        { label: "一般", value: "0" },
        { label: "比较", value: "1" },
        { label: "非常", value: "2" },
    ];
    const items = options.length >= 3 ? options : fallback;
    return (
        <div className="scale-row">
            {items.map((it) => (
                <button
                    key={it.value}
                    type="button"
                    className="scale-btn"
                    disabled={busy}
                    onClick={() => onPick(it.value)}
                >
                    {it.label}
                </button>
            ))}
            <style jsx>{`
                .scale-row {
                    display: grid;
                    grid-template-columns: repeat(${items.length}, 1fr);
                    gap: 6px;
                }
                .scale-btn {
                    padding: 10px 6px;
                    border-radius: 12px;
                    background: var(--color-surface-alt);
                    border: 1px solid
                        color-mix(
                            in srgb,
                            var(--color-text-muted) 22%,
                            transparent
                        );
                    color: var(--color-text);
                    font-size: 13px;
                    cursor: pointer;
                    transition:
                        background 0.2s ease,
                        transform 0.12s ease;
                }
                .scale-btn:hover:not(:disabled) {
                    background: color-mix(
                        in srgb,
                        var(--color-primary-from) 18%,
                        var(--color-surface-alt)
                    );
                    transform: translateY(-1px);
                }
                .scale-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
            `}</style>
        </div>
    );
}

function SingleInput({
    draft,
    onChange,
    onSubmit,
    quickReplies,
    onPick,
    placeholder,
    busy,
}: {
    readonly draft: string;
    readonly onChange: (s: string) => void;
    readonly onSubmit: () => void;
    readonly quickReplies: ReadonlyArray<string>;
    readonly onPick: (v: string) => void;
    readonly placeholder?: string;
    readonly busy?: boolean;
}) {
    return (
        <div className="input-stack">
            {quickReplies.length > 0 ? (
                <div className="chip-row">
                    {quickReplies.map((q) => (
                        <button
                            key={q}
                            type="button"
                            className="chip"
                            disabled={busy}
                            onClick={() => onPick(q)}
                        >
                            {q}
                        </button>
                    ))}
                </div>
            ) : null}
            <form
                className="input-row"
                onSubmit={(e) => {
                    e.preventDefault();
                    onSubmit();
                }}
            >
                <input
                    type="text"
                    value={draft}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder ?? "也可以直接写你的回答…"}
                    disabled={busy}
                />
                <button type="submit" disabled={!draft.trim() || busy}>
                    回复
                </button>
            </form>
            <style jsx>{`
                .input-stack {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }
                .chip-row {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                }
                .chip {
                    padding: 7px 12px;
                    border-radius: 999px;
                    background: var(--color-surface-alt);
                    color: var(--color-text);
                    font-size: 13px;
                    border: 1px solid
                        color-mix(
                            in srgb,
                            var(--color-text-muted) 22%,
                            transparent
                        );
                    cursor: pointer;
                    transition:
                        transform 0.15s ease,
                        background 0.2s ease;
                }
                .chip:hover {
                    background: color-mix(
                        in srgb,
                        var(--color-primary-from) 16%,
                        var(--color-surface-alt)
                    );
                    transform: translateY(-1px);
                }
                .input-row {
                    display: flex;
                    gap: 8px;
                }
                .input-row input {
                    flex: 1;
                    padding: 10px 14px;
                    border-radius: 999px;
                    background: var(--color-surface-alt);
                    border: 1px solid
                        color-mix(
                            in srgb,
                            var(--color-text-muted) 22%,
                            transparent
                        );
                    font-size: 14px;
                    color: var(--color-text);
                    outline: none;
                }
                .input-row input:focus {
                    border-color: color-mix(
                        in srgb,
                        var(--color-primary-from) 60%,
                        transparent
                    );
                }
                .input-row button {
                    padding: 10px 18px;
                    border-radius: 999px;
                    background: var(--gradient-primary);
                    color: var(--color-text-on-primary);
                    font-weight: 600;
                    cursor: pointer;
                }
                .input-row button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
            `}</style>
        </div>
    );
}

function MultiChipsInput({
    options,
    selected,
    onToggle,
    onSubmit,
    busy,
}: {
    readonly options: ReadonlyArray<string>;
    readonly selected: ReadonlyArray<string>;
    readonly onToggle: (v: string) => void;
    readonly onSubmit: (extras: string) => void;
    readonly busy?: boolean;
}) {
    void busy;
    const [extras, setExtras] = useState("");
    const extrasList = extras
        .split(/[,，、]/)
        .map((s) => s.trim())
        .filter(Boolean);
    const total = selected.length + extrasList.length;
    return (
        <div className="multi-stack">
            <div className="chip-row">
                {options.map((opt) => {
                    const active = selected.includes(opt);
                    return (
                        <button
                            key={opt}
                            type="button"
                            className={`chip ${active ? "chip--on" : ""}`}
                            onClick={() => onToggle(opt)}
                        >
                            {opt}
                        </button>
                    );
                })}
            </div>
            <input
                type="text"
                className="extras"
                placeholder="其他（可补充，用逗号分隔）"
                value={extras}
                onChange={(e) => setExtras(e.target.value)}
            />
            <div className="actions">
                <button
                    type="button"
                    className="primary"
                    onClick={() => {
                        onSubmit(extras);
                        setExtras("");
                    }}
                    disabled={total === 0}
                >
                    {total > 0
                        ? `选好 ${total} 项，继续`
                        : "点几个或自己填一项"}
                </button>
            </div>
            <style jsx>{`
                .multi-stack {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                .chip-row {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                }
                .chip {
                    padding: 7px 12px;
                    border-radius: 999px;
                    background: var(--color-surface-alt);
                    color: var(--color-text);
                    border: 1px solid
                        color-mix(
                            in srgb,
                            var(--color-text-muted) 22%,
                            transparent
                        );
                    cursor: pointer;
                    font-size: 13px;
                }
                .chip--on {
                    background: var(--gradient-primary);
                    color: var(--color-text-on-primary);
                    border-color: transparent;
                }
                .extras {
                    width: 100%;
                    padding: 9px 12px;
                    border-radius: 12px;
                    background: var(--color-surface-alt);
                    color: var(--color-text);
                    border: 1px solid
                        color-mix(
                            in srgb,
                            var(--color-text-muted) 22%,
                            transparent
                        );
                    font-size: 13px;
                    outline: none;
                }
                .extras:focus {
                    border-color: color-mix(
                        in srgb,
                        var(--color-primary) 55%,
                        transparent
                    );
                }
                .actions {
                    display: flex;
                    justify-content: flex-end;
                }
                .primary {
                    padding: 10px 18px;
                    border-radius: 999px;
                    background: var(--gradient-primary);
                    color: var(--color-text-on-primary);
                    font-weight: 600;
                    cursor: pointer;
                }
                .primary:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
            `}</style>
        </div>
    );
}

function NumberInput({
    placeholder,
    draft,
    onChange,
    onSubmit,
    quickReplies,
    busy,
}: {
    readonly placeholder: string;
    readonly draft: string;
    readonly onChange: (s: string) => void;
    readonly onSubmit: () => void;
    readonly quickReplies: ReadonlyArray<string>;
    readonly busy?: boolean;
}) {
    void busy;
    return (
        <div className="num-stack">
            {quickReplies.length > 0 ? (
                <div className="chip-row">
                    {quickReplies.map((q) => (
                        <button
                            key={q}
                            type="button"
                            className="chip"
                            onClick={() => onChange(q)}
                        >
                            {q}
                        </button>
                    ))}
                </div>
            ) : null}
            <form
                className="input-row"
                onSubmit={(e) => {
                    e.preventDefault();
                    onSubmit();
                }}
            >
                <input
                    inputMode="numeric"
                    value={draft}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                />
                <button type="submit" disabled={!draft.trim()}>
                    回复
                </button>
            </form>
            <style jsx>{`
                .num-stack {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }
                .chip-row {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                }
                .chip {
                    padding: 7px 12px;
                    border-radius: 999px;
                    background: var(--color-surface-alt);
                    border: 1px solid
                        color-mix(
                            in srgb,
                            var(--color-text-muted) 22%,
                            transparent
                        );
                    cursor: pointer;
                    font-size: 13px;
                }
                .input-row {
                    display: flex;
                    gap: 8px;
                }
                .input-row input {
                    flex: 1;
                    padding: 10px 14px;
                    border-radius: 999px;
                    background: var(--color-surface-alt);
                    border: 1px solid
                        color-mix(
                            in srgb,
                            var(--color-text-muted) 22%,
                            transparent
                        );
                    font-size: 14px;
                    color: var(--color-text);
                    outline: none;
                }
                .input-row button {
                    padding: 10px 18px;
                    border-radius: 999px;
                    background: var(--gradient-primary);
                    color: var(--color-text-on-primary);
                    font-weight: 600;
                    cursor: pointer;
                }
                .input-row button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
            `}</style>
        </div>
    );
}

function SailingIndicator({ label }: { readonly label: string }) {
    return (
        <div className="sailing">
            <div className="wave" />
            <div className="wave wave-2" />
            <p>{label}</p>
            <style jsx>{`
                .sailing {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 6px;
                    padding: 10px;
                    color: var(--color-text-muted);
                    font-size: 13px;
                }
                .wave,
                .wave-2 {
                    height: 4px;
                    width: 120px;
                    border-radius: 999px;
                    background: linear-gradient(
                        90deg,
                        transparent 0%,
                        var(--color-primary-from) 50%,
                        transparent 100%
                    );
                    animation: wave-pulse 1.6s ease-in-out infinite;
                }
                .wave-2 {
                    width: 80px;
                    opacity: 0.6;
                    animation-delay: 0.4s;
                }
                @keyframes wave-pulse {
                    0%,
                    100% {
                        transform: translateX(-30%);
                        opacity: 0.2;
                    }
                    50% {
                        transform: translateX(30%);
                        opacity: 1;
                    }
                }
            `}</style>
        </div>
    );
}

function ShipIcon() {
    return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2 13.5 11h6L13 13l-1 9-1-9-6.5-2h6L12 2z" />
        </svg>
    );
}

function WaypointSvg({ kind }: { readonly kind: WaypointKind }) {
    if (kind === "lighthouse") {
        return (
            <svg viewBox="0 0 220 200" width="100%" height="100%">
                <defs>
                    <linearGradient id="lh-tower" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#d9a774" />
                        <stop offset="35%" stopColor="#fff8e8" />
                        <stop offset="100%" stopColor="#a06a3d" />
                    </linearGradient>
                    <linearGradient id="lh-rock" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#7a3b22" />
                        <stop offset="100%" stopColor="#3c1a0d" />
                    </linearGradient>
                </defs>
                {/* rocky base */}
                <path
                    d="M10 180 Q40 150 80 160 Q110 142 140 162 Q180 150 210 180 L210 195 L10 195 Z"
                    fill="url(#lh-rock)"
                />
                <path
                    d="M40 170 Q70 155 95 168"
                    stroke="#fff8e8"
                    strokeWidth="2"
                    fill="none"
                    opacity="0.5"
                />
                <path
                    d="M130 170 Q160 158 190 172"
                    stroke="#fff8e8"
                    strokeWidth="2"
                    fill="none"
                    opacity="0.4"
                />
                {/* tower body — tapered */}
                <path
                    d="M88 165 L96 60 L124 60 L132 165 Z"
                    fill="url(#lh-tower)"
                    stroke="#5e2a18"
                    strokeWidth="1.2"
                />
                {/* red stripes */}
                <path d="M89 145 L131 145 L132 158 L88 158 Z" fill="#d24a2a" />
                <path d="M92 105 L128 105 L129 118 L91 118 Z" fill="#d24a2a" />
                <path d="M94 75 L126 75 L127 88 L93 88 Z" fill="#d24a2a" />
                {/* window */}
                <rect x="106" y="125" width="8" height="14" rx="2" fill="#1c3f5e" />
                {/* balcony / gallery */}
                <rect x="84" y="52" width="52" height="6" fill="#3c1a0d" />
                <rect x="86" y="46" width="48" height="6" fill="#5e2a18" />
                {/* lantern room glass */}
                <rect x="98" y="28" width="24" height="22" rx="2" fill="#ffeab0" stroke="#3c1a0d" />
                <line x1="110" y1="28" x2="110" y2="50" stroke="#3c1a0d" strokeWidth="1" />
                <line x1="98" y1="38" x2="122" y2="38" stroke="#3c1a0d" strokeWidth="1" />
                {/* roof */}
                <polygon points="96,28 124,28 110,12" fill="#5e2a18" />
                <circle cx="110" cy="10" r="2.5" fill="#3c1a0d" />
                {/* light beam */}
                <polygon
                    points="110,39 230,10 230,68"
                    fill="#fff8e0"
                    opacity="0.35"
                />
                {/* small bushes */}
                <ellipse cx="50" cy="172" rx="10" ry="5" fill="#2e7a4a" />
                <ellipse cx="170" cy="174" rx="9" ry="4" fill="#2e7a4a" />
            </svg>
        );
    }
    if (kind === "continent") {
        return (
            <svg viewBox="0 0 260 180" width="100%" height="100%">
                <defs>
                    <linearGradient id="ct-far" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#7a6a8a" />
                        <stop offset="100%" stopColor="#4a3f5a" />
                    </linearGradient>
                    <linearGradient id="ct-mid" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#5e2a18" />
                        <stop offset="100%" stopColor="#3c1a0d" />
                    </linearGradient>
                    <linearGradient id="ct-near" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#9c5235" />
                        <stop offset="100%" stopColor="#5e2a18" />
                    </linearGradient>
                </defs>
                {/* haze far layer */}
                <path
                    d="M0 140 Q60 110 110 118 T210 110 T260 130 L260 160 L0 160 Z"
                    fill="url(#ct-far)"
                    opacity="0.55"
                />
                {/* back mountain row */}
                <polygon points="20,140 55,90 90,140" fill="url(#ct-mid)" />
                <polygon points="65,140 110,55 155,140" fill="#3c1a0d" />
                <polygon points="130,140 175,75 215,140" fill="url(#ct-mid)" />
                <polygon points="195,140 230,95 255,140" fill="#3c1a0d" />
                {/* lit faces (right side of peaks catching the sun) */}
                <polygon points="110,55 155,140 132,140" fill="#7a3b22" opacity="0.85" />
                <polygon points="175,75 215,140 192,140" fill="#7a3b22" opacity="0.7" />
                {/* snow caps */}
                <polygon points="103,72 110,55 117,72 113,70 107,70" fill="#fff8e8" />
                <polygon points="170,90 175,75 180,90 177,87 173,87" fill="#fff8e8" />
                <polygon points="50,103 55,90 60,103" fill="#fff8e8" opacity="0.85" />
                {/* tree-line / coastal forest */}
                <path
                    d="M0 144 L8 138 L14 142 L22 134 L30 140 L38 134 L48 142 L58 138 L68 144 L80 138 L92 142 L104 138 L116 142 L130 138 L144 144 L158 138 L172 142 L188 138 L202 144 L218 138 L232 144 L248 138 L260 144 L260 158 L0 158 Z"
                    fill="#1f5a30"
                />
                {/* beach line */}
                <path
                    d="M0 158 Q130 154 260 158 L260 162 L0 162 Z"
                    fill="#f1c08a"
                />
                <path
                    d="M0 162 Q130 168 260 162 L260 170 L0 170 Z"
                    fill="#d9a774"
                    opacity="0.85"
                />
                {/* surf line */}
                <path
                    d="M0 162 Q50 158 130 162 T260 162"
                    stroke="#fff8e8"
                    strokeWidth="1.5"
                    fill="none"
                    opacity="0.7"
                />
            </svg>
        );
    }
    if (kind === "reef") {
        return (
            <svg viewBox="0 0 220 200" width="100%" height="100%">
                <defs>
                    <linearGradient id="rf-rock" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#5e2a18" />
                        <stop offset="100%" stopColor="#1a0a05" />
                    </linearGradient>
                </defs>
                {/* foam ring */}
                <ellipse cx="110" cy="174" rx="108" ry="16" fill="#fff8e8" opacity="0.55" />
                <ellipse cx="110" cy="176" rx="92" ry="10" fill="#fff8e8" opacity="0.85" />
                {/* back spire */}
                <polygon
                    points="62,176 88,96 108,176"
                    fill="url(#rf-rock)"
                />
                <polygon
                    points="88,96 96,108 88,160"
                    fill="#7a3b22"
                    opacity="0.6"
                />
                {/* tall middle spire */}
                <polygon
                    points="92,178 130,60 162,178"
                    fill="url(#rf-rock)"
                />
                <polygon
                    points="130,60 142,80 130,178 124,178"
                    fill="#9c5235"
                    opacity="0.55"
                />
                {/* front shorter spire */}
                <polygon
                    points="140,178 168,118 196,178"
                    fill="url(#rf-rock)"
                />
                <polygon
                    points="168,118 182,140 168,178 158,178"
                    fill="#7a3b22"
                    opacity="0.55"
                />
                {/* mossy seaweed clumps */}
                <path d="M80 176 Q84 168 90 176" stroke="#2e7a4a" strokeWidth="3" fill="none" />
                <path d="M150 176 Q156 168 162 176" stroke="#2e7a4a" strokeWidth="3" fill="none" />
                {/* splash droplets */}
                <circle cx="78" cy="160" r="2" fill="#fff8e8" />
                <circle cx="190" cy="162" r="2.2" fill="#fff8e8" />
                <circle cx="128" cy="150" r="1.6" fill="#fff8e8" />
                {/* warning gulls */}
                <path d="M30 50 Q42 42 54 50 Q42 46 30 50" fill="#fff8e8" />
                <path d="M22 56 L30 50 L24 52 Z" fill="#fff8e8" />
                <path d="M160 64 Q174 56 188 64 Q174 60 160 64" fill="#fff8e8" opacity="0.85" />
            </svg>
        );
    }
    if (kind === "harbor") {
        return (
            <svg viewBox="0 0 260 200" width="100%" height="100%">
                <defs>
                    <linearGradient id="hb-water" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2d5b80" />
                        <stop offset="100%" stopColor="#122d44" />
                    </linearGradient>
                </defs>
                {/* water foreground */}
                <rect x="0" y="160" width="260" height="40" fill="url(#hb-water)" />
                <path
                    d="M0 162 Q60 158 120 162 T260 162"
                    stroke="#fff8e8"
                    strokeWidth="1"
                    fill="none"
                    opacity="0.45"
                />
                {/* stone pier */}
                <rect x="0" y="142" width="260" height="22" fill="#7a3b22" />
                <rect x="0" y="138" width="260" height="6" fill="#a06a3d" />
                {/* pier bollards */}
                {[20, 70, 130, 190, 240].map((x) => (
                    <rect key={x} x={x - 3} y="132" width="6" height="10" fill="#3c1a0d" />
                ))}
                {/* warehouse left */}
                <rect x="22" y="78" width="58" height="64" fill="#f1c08a" />
                <polygon points="22,78 51,52 80,78" fill="#a93a1c" />
                {/* warehouse windows */}
                {[0, 1, 2].map((r) =>
                    [0, 1, 2].map((c) => (
                        <rect
                            key={`w1-${r}-${c}`}
                            x={32 + c * 14}
                            y={88 + r * 16}
                            width="8"
                            height="10"
                            fill="#1c3f5e"
                            stroke="#5e2a18"
                            strokeWidth="0.5"
                        />
                    )),
                )}
                {/* warehouse door */}
                <rect x="42" y="124" width="18" height="18" fill="#5e2a18" />
                {/* central building (tall) */}
                <rect x="100" y="62" width="46" height="80" fill="#ffd089" />
                <polygon points="100,62 123,40 146,62" fill="#7a3b22" />
                {[0, 1, 2, 3].map((r) =>
                    [0, 1].map((c) => (
                        <rect
                            key={`w2-${r}-${c}`}
                            x={110 + c * 14}
                            y={74 + r * 16}
                            width="8"
                            height="10"
                            fill="#1c3f5e"
                            stroke="#5e2a18"
                            strokeWidth="0.5"
                        />
                    )),
                )}
                {/* clock tower silhouette */}
                <circle cx="123" cy="56" r="4" fill="#fff8e8" stroke="#3c1a0d" />
                <line x1="123" y1="56" x2="123" y2="53" stroke="#3c1a0d" />
                <line x1="123" y1="56" x2="126" y2="56" stroke="#3c1a0d" />
                {/* right warehouse */}
                <rect x="162" y="84" width="50" height="58" fill="#f1c08a" />
                <polygon points="162,84 187,62 212,84" fill="#a93a1c" />
                {[0, 1, 2].map((r) =>
                    [0, 1, 2].map((c) => (
                        <rect
                            key={`w3-${r}-${c}`}
                            x={170 + c * 12}
                            y={92 + r * 14}
                            width="6"
                            height="9"
                            fill="#1c3f5e"
                            stroke="#5e2a18"
                            strokeWidth="0.5"
                        />
                    )),
                )}
                {/* crane */}
                <rect x="84" y="56" width="3" height="86" fill="#3c1a0d" />
                <rect x="84" y="56" width="32" height="3" fill="#3c1a0d" />
                <line x1="100" y1="59" x2="100" y2="86" stroke="#3c1a0d" strokeWidth="1.5" />
                <rect x="96" y="86" width="8" height="6" fill="#5e2a18" />
                {/* lighthouse on right */}
                <rect x="225" y="48" width="14" height="94" fill="#fff8e8" />
                <rect x="225" y="62" width="14" height="6" fill="#d24a2a" />
                <rect x="225" y="86" width="14" height="6" fill="#d24a2a" />
                <rect x="225" y="110" width="14" height="6" fill="#d24a2a" />
                <rect x="222" y="42" width="20" height="6" fill="#3c1a0d" />
                <rect x="226" y="34" width="12" height="10" fill="#ffd089" stroke="#3c1a0d" />
                <polygon points="226,34 238,34 232,24" fill="#5e2a18" />
                {/* warm window glow scatter */}
                {[
                    [34, 100],
                    [60, 124],
                    [118, 90],
                    [180, 100],
                ].map(([x, y]) => (
                    <circle
                        key={`g-${x}-${y}`}
                        cx={x}
                        cy={y}
                        r="2"
                        fill="#ffd089"
                        opacity="0.6"
                    />
                ))}
            </svg>
        );
    }
    // island default
    return (
        <svg viewBox="0 0 220 200" width="100%" height="100%">
            <defs>
                <radialGradient id="is-sand" cx="50%" cy="40%" r="60%">
                    <stop offset="0%" stopColor="#fde2c0" />
                    <stop offset="100%" stopColor="#a06a3d" />
                </radialGradient>
                <linearGradient id="is-frond" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#3f9c5d" />
                    <stop offset="100%" stopColor="#1f5a30" />
                </linearGradient>
            </defs>
            {/* underwater shadow */}
            <ellipse cx="110" cy="178" rx="106" ry="14" fill="#000" opacity="0.18" />
            {/* wet sand ring */}
            <ellipse cx="110" cy="168" rx="100" ry="20" fill="#d9a774" />
            {/* sand mound */}
            <ellipse cx="110" cy="160" rx="80" ry="22" fill="url(#is-sand)" />
            {/* mound highlight */}
            <path
                d="M60 158 Q110 138 160 158"
                stroke="#fff8e8"
                strokeWidth="2"
                fill="none"
                opacity="0.55"
            />
            {/* small rocks */}
            <ellipse cx="56" cy="166" rx="8" ry="4" fill="#5e2a18" />
            <ellipse cx="172" cy="168" rx="7" ry="3.5" fill="#5e2a18" />
            <ellipse cx="80" cy="172" rx="4" ry="2" fill="#3c1a0d" />
            {/* palm trunk with shading */}
            <path
                d="M120 152 Q116 110 124 78"
                stroke="#5e2a18"
                strokeWidth="9"
                fill="none"
                strokeLinecap="round"
            />
            <path
                d="M120 152 Q116 110 124 78"
                stroke="#7a3b22"
                strokeWidth="4"
                fill="none"
                strokeLinecap="round"
                opacity="0.85"
            />
            {/* trunk rings */}
            {[100, 116, 132, 144].map((y, i) => (
                <line
                    key={i}
                    x1={117 - i * 0.4}
                    y1={y}
                    x2={123 + i * 0.4}
                    y2={y - 1}
                    stroke="#3c1a0d"
                    strokeWidth="1"
                />
            ))}
            {/* coconuts cluster */}
            <circle cx="124" cy="80" r="4" fill="#3c1a0d" />
            <circle cx="129" cy="82" r="3.5" fill="#3c1a0d" />
            <circle cx="120" cy="84" r="3" fill="#5e2a18" />
            {/* palm fronds as filled shapes */}
            <path
                d="M124 78 Q98 62 64 60 Q92 72 124 84 Z"
                fill="url(#is-frond)"
            />
            <path
                d="M124 78 Q150 60 184 64 Q156 72 124 84 Z"
                fill="url(#is-frond)"
            />
            <path
                d="M124 78 Q118 50 96 32 Q116 60 124 84 Z"
                fill="url(#is-frond)"
            />
            <path
                d="M124 78 Q138 48 164 36 Q138 62 124 84 Z"
                fill="url(#is-frond)"
            />
            <path
                d="M124 78 Q124 44 122 18 Q126 50 128 82 Z"
                fill="url(#is-frond)"
            />
            {/* mid-ribs */}
            <path d="M124 78 Q104 64 70 62" stroke="#1f5a30" strokeWidth="1.2" fill="none" />
            <path d="M124 78 Q146 64 178 66" stroke="#1f5a30" strokeWidth="1.2" fill="none" />
            <path d="M124 78 Q120 52 102 36" stroke="#1f5a30" strokeWidth="1.2" fill="none" />
            <path d="M124 78 Q138 52 160 40" stroke="#1f5a30" strokeWidth="1.2" fill="none" />
            {/* small bushes */}
            <ellipse cx="56" cy="154" rx="14" ry="8" fill="#2e7a4a" />
            <ellipse cx="56" cy="150" rx="10" ry="5" fill="#3f9c5d" />
            <ellipse cx="174" cy="156" rx="12" ry="7" fill="#2e7a4a" />
            <ellipse cx="174" cy="152" rx="8" ry="4" fill="#3f9c5d" />
            {/* foreground ripple */}
            <path
                d="M30 184 Q110 178 200 184"
                stroke="#fff8e8"
                strokeWidth="1.5"
                fill="none"
                opacity="0.6"
            />
        </svg>
    );
}
