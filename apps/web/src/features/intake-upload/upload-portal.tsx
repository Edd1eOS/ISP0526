"use client";

/**
 * UploadPortal
 *
 * Wormhole-style drop zone for the standalone upload step. The drop
 * target is rendered as a perspective-projected tunnel: a stack of
 * concentric rings receding into depth, wrapped around a swirling
 * conic-gradient core. On drag-over the wormhole "opens" - rings
 * spread outward in z, rotation accelerates, the core brightens and
 * radial streaks pull inward, suggesting the file is being drawn in.
 *
 * Same extraction pipeline as ResumeUploadPanel: client-side parse
 * (PDF / DOCX) -> server action returns a ClarifyPatch -> reported up
 * via onResult.
 */

import {
    useCallback,
    useRef,
    useState,
    useTransition,
    type DragEvent,
} from "react";
import { extractPdfText } from "@/lib/pdf/extract-pdf-text";
import { extractDocxText } from "@/lib/docx/extract-docx-text";
import {
    summarizeUploadAction,
    type SummarizeUploadResult,
} from "./upload-actions";

const PDF_MIME = "application/pdf";
const DOCX_MIME =
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MAX_BYTES = 10 * 1024 * 1024;

type Status = "idle" | "parsing" | "extracting" | "done" | "error";

export interface UploadPortalResult extends SummarizeUploadResult {
    readonly fileName: string;
}

interface Props {
    readonly onResult: (r: UploadPortalResult) => void;
}

function detectKind(file: File): "pdf" | "docx" | null {
    const name = file.name.toLowerCase();
    if (file.type === PDF_MIME || name.endsWith(".pdf")) return "pdf";
    if (file.type === DOCX_MIME || name.endsWith(".docx")) return "docx";
    return null;
}

// Ring depth layers - each value drives translateZ to build the tunnel.
interface RingLayer {
    readonly r: number;
    readonly z: number;
    readonly dur: number;
    readonly opacity: number;
    readonly width: number;
    readonly dashed: boolean;
}
const RING_LAYERS: ReadonlyArray<RingLayer> = [
    { r: 96, z: 60, dur: 18, opacity: 0.95, width: 2.4, dashed: true },
    { r: 84, z: 30, dur: 14, opacity: 0.85, width: 1.8, dashed: false },
    { r: 70, z: 4, dur: 11, opacity: 0.7, width: 1.6, dashed: true },
    { r: 56, z: -22, dur: 8, opacity: 0.55, width: 1.4, dashed: false },
    { r: 42, z: -46, dur: 6, opacity: 0.45, width: 1.2, dashed: true },
    { r: 28, z: -68, dur: 4, opacity: 0.35, width: 1, dashed: false },
];

export function UploadPortal({ onResult }: Props) {
    const [status, setStatus] = useState<Status>("idle");
    const [progress, setProgress] = useState(0);
    const [fileName, setFileName] = useState<string>("");
    const [error, setError] = useState<string | null>(null);
    const [dragOver, setDragOver] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const [, startTransition] = useTransition();

    const handleFile = useCallback(
        (file: File) => {
            setError(null);
            const kind = detectKind(file);
            if (!kind) {
                setStatus("error");
                setError("只支持 PDF 或 Word(.docx) 文件");
                return;
            }
            if (file.size > MAX_BYTES) {
                setStatus("error");
                setError("文件超过 10 MB，换个小一点的？");
                return;
            }
            setStatus("parsing");
            setProgress(5);
            setFileName(file.name);

            void (async () => {
                try {
                    let text: string;
                    if (kind === "pdf") {
                        text = await extractPdfText(file, (pct) => {
                            setProgress((prev) => Math.max(prev, pct * 0.8));
                        });
                    } else {
                        setProgress(40);
                        text = await extractDocxText(file);
                    }
                    setProgress(85);
                    setStatus("extracting");
                    startTransition(async () => {
                        try {
                            const r = await summarizeUploadAction({
                                text,
                                fileName: file.name,
                            });
                            setProgress(100);
                            if (!r.ok) {
                                setStatus("error");
                                setError(r.error ?? "解析失败");
                                return;
                            }
                            setStatus("done");
                            onResult({ ...r, fileName: file.name });
                        } catch (cause) {
                            // reason: surface unexpected server-action failures to user
                            // eslint-disable-next-line no-console
                            console.error(
                                "[upload-portal] extraction failed",
                                cause,
                            );
                            setStatus("error");
                            setError("提取失败，再试一次？");
                        }
                    });
                } catch (cause) {
                    const msg =
                        cause instanceof Error ? cause.message : "解析失败";
                    setStatus("error");
                    setError(msg);
                }
            })();
        },
        [onResult],
    );

    const onDrop = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) handleFile(file);
    };

    const active = status === "parsing" || status === "extracting";
    const opened = dragOver || status !== "idle";

    let centerLabel: string;
    if (status === "idle") {
        centerLabel = dragOver ? "松手投入虫洞" : "拖到这里 / 点击选择";
    } else if (status === "parsing") {
        centerLabel = "读取中…";
    } else if (status === "extracting") {
        centerLabel = "整理中…";
    } else if (status === "done") {
        centerLabel = "传送完成";
    } else {
        centerLabel = "出错了";
    }

    return (
        <div className="flex w-full flex-col items-center gap-6 sm:flex-row sm:items-stretch sm:justify-center">
            {/* Wormhole */}
            <div
                role="button"
                tabIndex={0}
                aria-label="拖入或点击上传简历"
                onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                }}
                onDragEnter={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => inputRef.current?.click()}
                onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        inputRef.current?.click();
                    }
                }}
                className={`hole-stage relative flex h-[280px] w-[280px] shrink-0 cursor-pointer items-center justify-center select-none ${opened ? "hole-stage--open" : ""
                    } ${active ? "hole-stage--active" : ""} ${status === "done" ? "hole-stage--done" : ""
                    } ${status === "error" ? "hole-stage--error" : ""}`}
            >
                {/* Outer halo / event horizon */}
                <div className="hole-halo" aria-hidden />

                {/* Idle nebula - smooth gradient orb that fades out when the
                    hole opens, so the resting state stays calm. */}
                <div className="hole-rest" aria-hidden />

                {/* Inward radial streaks */}
                <div className="hole-streaks" aria-hidden>
                    {Array.from({ length: 12 }).map((_, i) => (
                        <span
                            key={i}
                            className="hole-streak"
                            style={
                                {
                                    "--rot": `${(i * 360) / 12}deg`,
                                    animationDelay: `${(i * 0.12) % 1.4}s`,
                                } as React.CSSProperties
                            }
                        />
                    ))}
                </div>

                {/* Tunnel rings stacked in 3D */}
                <div className="hole-tunnel" aria-hidden>
                    {RING_LAYERS.map((layer, i) => (
                        <svg
                            key={i}
                            className={`hole-ring ${i % 2 === 0
                                    ? "hole-ring--cw"
                                    : "hole-ring--ccw"
                                }`}
                            viewBox="0 0 200 200"
                            style={
                                {
                                    "--z": `${layer.z}px`,
                                    "--dur": `${layer.dur}s`,
                                    "--ring-opacity": layer.opacity,
                                } as React.CSSProperties
                            }
                        >
                            <defs>
                                <linearGradient
                                    id={`hole-grad-${i}`}
                                    x1="0"
                                    y1="0"
                                    x2="1"
                                    y2="1"
                                >
                                    <stop
                                        offset="0%"
                                        stopColor="var(--color-primary-from)"
                                    />
                                    <stop
                                        offset="100%"
                                        stopColor="var(--color-primary-to, var(--color-primary-from))"
                                    />
                                </linearGradient>
                            </defs>
                            <circle
                                cx="100"
                                cy="100"
                                r={layer.r}
                                fill="none"
                                stroke={`url(#hole-grad-${i})`}
                                strokeWidth={layer.width}
                                strokeLinecap="round"
                                strokeDasharray={
                                    layer.dashed ? "12 8" : "3 6"
                                }
                            />
                        </svg>
                    ))}
                </div>

                {/* Swirling conic core */}
                <div className="hole-swirl" aria-hidden />
                <div className="hole-core" aria-hidden />

                {/* Orbiting plane - stays in motion at all states */}
                <div className="hole-orbit" aria-hidden>
                    <svg
                        className="hole-plane"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        aria-hidden
                    >
                        <path d="M21 16v-2l-8.5-5V3.5C12.5 2.67 11.83 2 11 2s-1.5.67-1.5 1.5V9L1 14v2l8.5-2.5V19L7 20.5V22l4-1 4 1v-1.5L12.5 19v-5.5L21 16z" />
                    </svg>
                </div>

                {/* Center label */}
                <div className="pointer-events-none relative z-10 flex flex-col items-center gap-1 px-4 text-center">
                    <p
                        className="text-text text-sm font-semibold transition-all"
                        style={{
                            textShadow: opened
                                ? "0 0 14px color-mix(in srgb, var(--color-primary-from) 60%, transparent)"
                                : "none",
                        }}
                    >
                        {centerLabel}
                    </p>
                    <p className="text-text-muted text-[11px]">
                        PDF · Word(.docx) · ≤ 10 MB
                    </p>
                </div>

                <input
                    ref={inputRef}
                    type="file"
                    accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    className="hidden"
                    onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFile(f);
                        e.target.value = "";
                    }}
                />
            </div>

            {/* Floating status card */}
            <aside
                className={`hole-card flex w-full max-w-xs flex-col gap-3 px-5 py-4 transition-all ${status === "idle" && !dragOver ? "hole-card--dim" : ""
                    }`}
                style={{
                    background: "var(--color-surface)",
                    borderRadius: "var(--radius-card-md)",
                    boxShadow: "var(--shadow-clay-card)",
                }}
                aria-live="polite"
            >
                <div className="flex items-center justify-between">
                    <p className="text-text text-sm font-semibold">
                        {status === "idle" && !fileName
                            ? "等待文件"
                            : status === "done"
                                ? "已上传"
                                : "传输中"}
                    </p>
                    <span
                        className="text-[11px] uppercase tracking-wider"
                        style={{
                            color:
                                status === "error"
                                    ? "var(--color-danger)"
                                    : "var(--color-text-muted)",
                        }}
                    >
                        {status === "error"
                            ? "错误"
                            : status === "done"
                                ? "完成"
                                : status === "extracting"
                                    ? "整理"
                                    : status === "parsing"
                                        ? "读取"
                                        : "待机"}
                    </span>
                </div>

                {fileName ? (
                    <p
                        className="text-text-muted truncate text-xs"
                        title={fileName}
                    >
                        {fileName}
                    </p>
                ) : (
                    <p className="text-text-muted text-xs leading-relaxed">
                        把简历或成绩单拖到左边的虫洞里，进度会出现在这里。
                    </p>
                )}

                <div
                    className="h-1.5 w-full overflow-hidden"
                    style={{
                        background: "var(--color-surface-alt)",
                        borderRadius: 999,
                    }}
                    aria-hidden
                >
                    <div
                        className="h-full transition-all duration-300"
                        style={{
                            width: `${status === "idle" ? 0 : progress}%`,
                            background:
                                status === "error"
                                    ? "var(--color-danger)"
                                    : "var(--gradient-primary)",
                        }}
                    />
                </div>

                {status === "error" && error ? (
                    <p
                        className="text-xs"
                        style={{ color: "var(--color-danger)" }}
                    >
                        {error}
                    </p>
                ) : null}
            </aside>

            <style jsx>{`
                .hole-stage {
                    isolation: isolate;
                    perspective: 720px;
                    perspective-origin: 50% 50%;
                    transition: transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
                }
                .hole-stage--open {
                    transform: scale(1.02);
                }
                .hole-stage--active {
                    transform: scale(1.04);
                }

                /* Event-horizon halo */
                .hole-halo {
                    position: absolute;
                    inset: -10%;
                    border-radius: 9999px;
                    background: radial-gradient(
                        closest-side,
                        color-mix(
                                in srgb,
                                var(--color-primary-from) 65%,
                                transparent
                            )
                            0%,
                        transparent 65%
                    );
                    opacity: 0.22;
                    filter: blur(18px);
                    transition:
                        opacity 0.5s ease,
                        transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1),
                        filter 0.4s ease;
                    z-index: 0;
                }
                .hole-stage--open .hole-halo {
                    opacity: 0.6;
                    transform: scale(1.08);
                }
                .hole-stage--active .hole-halo {
                    opacity: 0.8;
                    transform: scale(1.14);
                    animation: hole-halo-pulse 1.8s ease-in-out infinite;
                }
                .hole-stage--done .hole-halo {
                    opacity: 0.5;
                }
                .hole-stage--error .hole-halo {
                    background: radial-gradient(
                        closest-side,
                        var(--color-danger) 0%,
                        transparent 65%
                    );
                }

                /* Idle nebula: layered radial gradients giving a calm,
                   saturated concentric orb. Fades out when the hole opens. */
                .hole-rest {
                    position: absolute;
                    inset: 8%;
                    border-radius: 9999px;
                    background:
                        radial-gradient(
                            circle at 50% 48%,
                            color-mix(
                                    in srgb,
                                    var(--color-primary-from) 55%,
                                    white
                                )
                                0%,
                            color-mix(
                                    in srgb,
                                    var(--color-primary-from) 75%,
                                    transparent
                                )
                                28%,
                            transparent 55%
                        ),
                        radial-gradient(
                            circle at 50% 50%,
                            color-mix(
                                    in srgb,
                                    var(--color-primary-from) 60%,
                                    transparent
                                )
                                0%,
                            color-mix(
                                    in srgb,
                                    var(--color-primary-to, var(--color-primary-from))
                                        50%,
                                    transparent
                                )
                                45%,
                            transparent 80%
                        );
                    filter: blur(3px);
                    opacity: 0;
                    transform: scale(0.7);
                    transition:
                        opacity 0.55s ease,
                        transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1),
                        filter 0.4s ease;
                    z-index: 1;
                }
                .hole-stage--open .hole-rest {
                    opacity: 0.95;
                    transform: scale(1);
                    filter: blur(2px) brightness(1.05);
                    animation: hole-rest-breathe 4s ease-in-out infinite;
                }
                .hole-stage--active .hole-rest {
                    opacity: 1;
                    transform: scale(1.03);
                    animation: hole-rest-breathe 2.4s ease-in-out infinite;
                }

                /* Tunnel container preserves 3D so rings stack in depth */
                .hole-tunnel {
                    position: absolute;
                    inset: 0;
                    transform-style: preserve-3d;
                    transform: rotateX(6deg);
                    transition: transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1);
                    z-index: 2;
                }
                .hole-stage--open .hole-tunnel {
                    transform: rotateX(0deg) translateZ(10px);
                }
                .hole-stage--active .hole-tunnel {
                    transform: rotateX(-4deg) translateZ(20px);
                }

                .hole-ring {
                    position: absolute;
                    inset: 0;
                    width: 100%;
                    height: 100%;
                    transform-origin: 50% 50%;
                    opacity: var(--ring-opacity);
                    will-change: transform;
                    transition:
                        opacity 0.55s ease,
                        animation-duration 0.5s ease;
                }
                .hole-ring--cw {
                    animation: hole-ring-cw var(--dur) linear infinite;
                }
                .hole-ring--ccw {
                    animation: hole-ring-ccw var(--dur) linear infinite;
                }
                .hole-stage--open .hole-ring {
                    opacity: 0;
                }
                .hole-stage--active .hole-ring {
                    opacity: 0;
                }
                .hole-stage--done .hole-ring {
                    opacity: 0;
                }

                /* Swirling conic ring gives the wormhole twist */
                .hole-swirl {
                    position: absolute;
                    width: 70%;
                    height: 70%;
                    border-radius: 9999px;
                    background: conic-gradient(
                        from 0deg,
                        transparent 0deg,
                        color-mix(
                                in srgb,
                                var(--color-primary-from) 80%,
                                transparent
                            )
                            60deg,
                        transparent 140deg,
                        color-mix(
                                in srgb,
                                var(--color-primary-to, var(--color-primary-from))
                                    80%,
                                transparent
                            )
                            220deg,
                        transparent 320deg
                    );
                    -webkit-mask: radial-gradient(
                        closest-side,
                        transparent 14%,
                        black 24%,
                        black 78%,
                        transparent 92%
                    );
                    mask: radial-gradient(
                        closest-side,
                        transparent 14%,
                        black 24%,
                        black 78%,
                        transparent 92%
                    );
                    filter: blur(10px);
                    opacity: 0.2;
                    animation: hole-ring-cw 14s linear infinite;
                    transition:
                        opacity 0.55s ease,
                        filter 0.4s ease;
                    z-index: 1;
                }
                .hole-stage--open .hole-swirl {
                    opacity: 0.95;
                    filter: blur(4px);
                    animation-duration: 3s;
                }
                .hole-stage--active .hole-swirl {
                    opacity: 1;
                    filter: blur(3px) brightness(1.15);
                    animation-duration: 1.2s;
                }
                .hole-stage--error .hole-swirl {
                    background: conic-gradient(
                        from 0deg,
                        transparent 0deg,
                        var(--color-danger) 60deg,
                        transparent 140deg,
                        var(--color-danger) 220deg,
                        transparent 320deg
                    );
                }

                /* Bright inner core */
                .hole-core {
                    position: absolute;
                    width: 28%;
                    height: 28%;
                    border-radius: 9999px;
                    background: radial-gradient(
                        circle at 50% 45%,
                        color-mix(
                                in srgb,
                                var(--color-primary-from) 55%,
                                white
                            )
                            0%,
                        var(--color-primary-from) 55%,
                        transparent 100%
                    );
                    opacity: 0.55;
                    filter: blur(4px);
                    transform: scale(0.7);
                    transition:
                        opacity 0.5s ease,
                        transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1),
                        filter 0.4s ease;
                    z-index: 1;
                }
                .hole-stage--open .hole-core {
                    opacity: 0.9;
                    transform: scale(1);
                    filter: blur(3px) brightness(1.1);
                }
                .hole-stage--active .hole-core {
                    opacity: 1;
                    transform: scale(1.1);
                    animation: hole-core-pulse 1.6s ease-in-out infinite;
                }

                /* Inward streaks (light rays drawn into the hole) */
                .hole-streaks {
                    position: absolute;
                    inset: 0;
                    border-radius: 9999px;
                    z-index: 1;
                    opacity: 0;
                    transition: opacity 0.45s ease;
                    pointer-events: none;
                }
                .hole-stage--open .hole-streaks {
                    opacity: 0.55;
                }
                .hole-stage--active .hole-streaks {
                    opacity: 0.9;
                }
                .hole-streak {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    width: 50%;
                    height: 1.5px;
                    transform-origin: 0% 50%;
                    transform: rotate(var(--rot, 0deg));
                    background: linear-gradient(
                        90deg,
                        transparent 0%,
                        color-mix(
                                in srgb,
                                var(--color-primary-from) 80%,
                                transparent
                            )
                            55%,
                        transparent 100%
                    );
                    filter: blur(0.4px);
                    animation: hole-streak-pull 1.8s linear infinite;
                }
                .hole-stage--active .hole-streak {
                    animation-duration: 0.9s;
                }

                .hole-card--dim {
                    opacity: 0.86;
                }

                @keyframes hole-ring-cw {
                    from {
                        transform: translateZ(var(--z, 0px)) rotate(0deg);
                    }
                    to {
                        transform: translateZ(var(--z, 0px)) rotate(360deg);
                    }
                }
                @keyframes hole-ring-ccw {
                    from {
                        transform: translateZ(var(--z, 0px)) rotate(0deg);
                    }
                    to {
                        transform: translateZ(var(--z, 0px)) rotate(-360deg);
                    }
                }
                @keyframes hole-core-pulse {
                    0%,
                    100% {
                        filter: blur(3px) brightness(1);
                    }
                    50% {
                        filter: blur(5px) brightness(1.3);
                    }
                }
                @keyframes hole-halo-pulse {
                    0%,
                    100% {
                        filter: blur(18px);
                    }
                    50% {
                        filter: blur(24px) brightness(1.15);
                    }
                }
                @keyframes hole-streak-pull {
                    0% {
                        transform: rotate(var(--rot, 0deg)) translateX(0%)
                            scaleX(0.4);
                        opacity: 0;
                    }
                    25% {
                        opacity: 1;
                    }
                    100% {
                        transform: rotate(var(--rot, 0deg)) translateX(-65%)
                            scaleX(0.15);
                        opacity: 0;
                    }
                }
                @keyframes hole-rest-breathe {
                    0%,
                    100% {
                        transform: scale(0.92);
                        filter: blur(2px) brightness(0.95);
                        opacity: 0.78;
                    }
                    50% {
                        transform: scale(1.12);
                        filter: blur(4px) brightness(1.25);
                        opacity: 1;
                    }
                }

                /* Plane orbits the concentric circles */
                .hole-orbit {
                    position: absolute;
                    inset: 6%;
                    z-index: 4;
                    pointer-events: none;
                    animation: hole-orbit-spin 9s linear infinite;
                    transform-origin: 50% 50%;
                }
                .hole-stage--open .hole-orbit {
                    animation-duration: 4s;
                }
                .hole-stage--active .hole-orbit {
                    animation-duration: 2.4s;
                }
                .hole-plane {
                    position: absolute;
                    top: -8px;
                    left: 50%;
                    width: 22px;
                    height: 22px;
                    /* Translate up + tilt so the nose follows the orbit direction. */
                    transform: translateX(-50%) rotate(90deg);
                    color: var(--color-primary-from);
                    filter: drop-shadow(
                        0 0 6px
                            color-mix(
                                in srgb,
                                var(--color-primary-from) 70%,
                                transparent
                            )
                    );
                    transition: color 0.4s ease;
                }
                .hole-stage--error .hole-plane {
                    color: var(--color-danger);
                }
                @keyframes hole-orbit-spin {
                    from {
                        transform: rotate(0deg);
                    }
                    to {
                        transform: rotate(360deg);
                    }
                }

                @media (prefers-reduced-motion: reduce) {
                    .hole-ring,
                    .hole-swirl,
                    .hole-core,
                    .hole-halo,
                    .hole-rest,
                    .hole-orbit,
                    .hole-streak {
                        animation: none !important;
                    }
                }
            `}</style>
        </div>
    );
}
