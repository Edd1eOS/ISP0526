"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { startIntakeFromAudioAction } from "./voice-actions";

type Status =
    | "idle"
    | "requesting"
    | "listening"
    | "captured"
    | "uploading"
    | "error";

const MAX_SECONDS = 60;

// reason: pick the first mime the browser actually supports - Safari does
// not implement webm/opus, Chromium prefers it, Firefox is fine with either.
const CANDIDATE_MIMES: ReadonlyArray<string> = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/mpeg",
];

function pickMime(): string | undefined {
    if (typeof MediaRecorder === "undefined") return undefined;
    for (const m of CANDIDATE_MIMES) {
        if (MediaRecorder.isTypeSupported(m)) return m;
    }
    return undefined;
}

export function VoiceOrb() {
    const router = useRouter();
    const [status, setStatus] = useState<Status>("idle");
    const [seconds, setSeconds] = useState(0);
    const [error, setError] = useState<string>("");
    const [blob, setBlob] = useState<Blob | null>(null);
    const [blobUrl, setBlobUrl] = useState<string>("");

    const recorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const streamRef = useRef<MediaStream | null>(null);
    const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Revoke object URLs when they change or the component unmounts so we
    // do not leak memory across multiple takes.
    useEffect(() => {
        return () => {
            if (blobUrl) URL.revokeObjectURL(blobUrl);
        };
    }, [blobUrl]);

    useEffect(() => {
        return () => {
            // Hard cleanup if the user navigates away mid-recording.
            stopTimers();
            if (recorderRef.current && recorderRef.current.state !== "inactive") {
                recorderRef.current.stop();
            }
            releaseStream();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const stopTimers = () => {
        if (tickRef.current) {
            clearInterval(tickRef.current);
            tickRef.current = null;
        }
        if (autoStopRef.current) {
            clearTimeout(autoStopRef.current);
            autoStopRef.current = null;
        }
    };

    const releaseStream = () => {
        const s = streamRef.current;
        if (s) {
            for (const t of s.getTracks()) t.stop();
            streamRef.current = null;
        }
    };

    const reset = () => {
        stopTimers();
        releaseStream();
        chunksRef.current = [];
        recorderRef.current = null;
        if (blobUrl) URL.revokeObjectURL(blobUrl);
        setBlob(null);
        setBlobUrl("");
        setSeconds(0);
        setError("");
        setStatus("idle");
    };

    const startRecording = async () => {
        setError("");
        setStatus("requesting");
        const mime = pickMime();
        if (!mime) {
            setError("你的浏览器不支持录音，换个 Chrome / Edge 再试？");
            setStatus("error");
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
            });
            streamRef.current = stream;
            const rec = new MediaRecorder(stream, { mimeType: mime });
            recorderRef.current = rec;
            chunksRef.current = [];
            rec.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
            };
            rec.onstop = () => {
                const out = new Blob(chunksRef.current, { type: mime });
                const url = URL.createObjectURL(out);
                setBlob(out);
                setBlobUrl(url);
                stopTimers();
                releaseStream();
                setStatus("captured");
            };
            rec.onerror = () => {
                setError("录音出了点意外，再试一次？");
                stopTimers();
                releaseStream();
                setStatus("error");
            };
            rec.start();
            setStatus("listening");
            setSeconds(0);
            tickRef.current = setInterval(() => {
                setSeconds((s) => s + 1);
            }, 1000);
            autoStopRef.current = setTimeout(() => {
                if (rec.state !== "inactive") rec.stop();
            }, MAX_SECONDS * 1000);
        } catch (cause) {
            // eslint-disable-next-line no-console
            console.warn("[voice] getUserMedia failed", cause);
            setError("没拿到麦克风权限，先在浏览器允许一下？");
            setStatus("error");
        }
    };

    const stopRecording = () => {
        const rec = recorderRef.current;
        if (rec && rec.state !== "inactive") rec.stop();
    };

    const submit = async () => {
        if (!blob) return;
        setStatus("uploading");
        try {
            const form = new FormData();
            const filename = `voice-${Date.now()}.${blob.type.includes("mp4") ? "mp4" : "webm"}`;
            form.append("audio", blob, filename);
            form.append("seconds", String(seconds));
            const result = await startIntakeFromAudioAction(form);
            if (!result.ok || !result.sessionId) {
                setError(`抽取失败：${result.error ?? "未知错误"}`);
                setStatus("captured");
                return;
            }
            router.push(`/intake/review/${result.sessionId}`);
        } catch (cause) {
            // eslint-disable-next-line no-console
            console.error("[voice] submit failed", cause);
            setError("出错了，再试一次？");
            setStatus("captured");
        }
    };

    return (
        <div
            className="space-y-6 p-8 text-center"
            style={{
                background: "var(--color-surface)",
                borderRadius: "var(--radius-card-md)",
                boxShadow: "var(--shadow-clay-card)",
            }}
        >
            <Orb status={status} seconds={seconds} />

            <div className="space-y-2">
                <StatusLine status={status} seconds={seconds} />
                {error ? (
                    <p className="text-warning text-sm">{error}</p>
                ) : null}
            </div>

            <Controls
                status={status}
                hasTake={Boolean(blob)}
                blobUrl={blobUrl}
                onStart={startRecording}
                onStop={stopRecording}
                onRedo={reset}
                onSubmit={submit}
            />

            <style>{`
                @keyframes orb-pulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.06); }
                }
                @keyframes orb-spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}

function Orb({ status, seconds }: { status: Status; seconds: number }) {
    const listening = status === "listening";
    const uploading = status === "uploading";
    const remaining = Math.max(0, MAX_SECONDS - seconds);
    const ringColor = listening
        ? "var(--color-warning, #c84a3f)"
        : uploading
            ? "var(--color-primary-from)"
            : "var(--color-surface-alt)";
    return (
        <div className="relative mx-auto h-44 w-44">
            <div
                className="absolute inset-0 rounded-full"
                style={{
                    background: "var(--gradient-primary)",
                    boxShadow: "var(--shadow-clay-primary)",
                    animation: listening
                        ? "orb-pulse 1.2s ease-in-out infinite"
                        : undefined,
                }}
            />
            <div
                className="absolute -inset-3 rounded-full"
                style={{
                    border: `3px dashed ${ringColor}`,
                    animation: uploading
                        ? "orb-spin 2s linear infinite"
                        : undefined,
                    opacity: status === "idle" ? 0.4 : 1,
                }}
            />
            <div className="text-text-on-primary absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-5xl" aria-hidden>
                    🎙
                </span>
                {listening ? (
                    <span className="mt-1 text-sm font-semibold">
                        {remaining}s
                    </span>
                ) : null}
            </div>
        </div>
    );
}

function StatusLine({
    status,
    seconds,
}: {
    status: Status;
    seconds: number;
}) {
    const text = (() => {
        switch (status) {
            case "idle":
                return "点开始，说够 10–60 秒就行";
            case "requesting":
                return "正在向浏览器要麦克风…";
            case "listening":
                return `录音中 · 已说 ${seconds}s`;
            case "captured":
                return `录好了 · ${seconds}s · 可以回放、重录，或直接交给 AI`;
            case "uploading":
                return "AI 正在听写 + 整理…";
            case "error":
                return "出了点状况";
        }
    })();
    return <p className="text-text text-sm font-medium">{text}</p>;
}

function Controls({
    status,
    hasTake,
    blobUrl,
    onStart,
    onStop,
    onRedo,
    onSubmit,
}: {
    status: Status;
    hasTake: boolean;
    blobUrl: string;
    onStart: () => void;
    onStop: () => void;
    onRedo: () => void;
    onSubmit: () => void;
}) {
    if (status === "listening") {
        return (
            <button
                type="button"
                onClick={onStop}
                className="text-text-on-primary px-6 py-3 text-sm font-semibold transition-transform active:scale-95"
                style={{
                    background: "var(--color-warning, #c84a3f)",
                    borderRadius: "var(--radius-button)",
                    boxShadow: "var(--shadow-clay-primary)",
                }}
            >
                我说完了
            </button>
        );
    }

    if (status === "captured" || (status === "error" && hasTake)) {
        return (
            <div className="flex flex-col items-center gap-4">
                {blobUrl ? (
                    <audio
                        controls
                        src={blobUrl}
                        className="w-full max-w-md"
                    />
                ) : null}
                <div className="flex flex-wrap items-center justify-center gap-3">
                    <button
                        type="button"
                        onClick={onRedo}
                        className="text-text px-5 py-2.5 text-sm font-semibold transition-transform active:scale-95"
                        style={{
                            background: "var(--color-surface-alt)",
                            borderRadius: "var(--radius-button)",
                            boxShadow: "var(--shadow-clay-inset)",
                        }}
                    >
                        重录
                    </button>
                    <button
                        type="button"
                        onClick={onSubmit}
                        className="text-text-on-primary px-6 py-3 text-sm font-semibold transition-transform active:scale-95"
                        style={{
                            background: "var(--gradient-primary)",
                            borderRadius: "var(--radius-button)",
                            boxShadow: "var(--shadow-clay-primary)",
                        }}
                    >
                        交给 AI 整理
                    </button>
                </div>
            </div>
        );
    }

    if (status === "uploading") {
        return (
            <button
                type="button"
                disabled
                className="text-text-on-primary px-6 py-3 text-sm font-semibold opacity-60"
                style={{
                    background: "var(--gradient-primary)",
                    borderRadius: "var(--radius-button)",
                    boxShadow: "var(--shadow-clay-primary)",
                }}
            >
                AI 整理中…
            </button>
        );
    }

    return (
        <button
            type="button"
            onClick={onStart}
            disabled={status === "requesting"}
            className="text-text-on-primary px-6 py-3 text-sm font-semibold transition-transform active:scale-95 disabled:opacity-60"
            style={{
                background: "var(--gradient-primary)",
                borderRadius: "var(--radius-button)",
                boxShadow: "var(--shadow-clay-primary)",
            }}
        >
            {status === "requesting" ? "等麦克风…" : "开始录音"}
        </button>
    );
}
