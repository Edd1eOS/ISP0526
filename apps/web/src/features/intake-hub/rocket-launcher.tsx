"use client";

/**
 * Single-CTA intake launcher: a clay rocket with a single "起飞" button
 * underneath. Pressing the button triggers the launch animation (rocket
 * lifts off, page fades) and then navigates to the chat module. A small
 * "fill a form" escape hatch lives tucked away in the corner.
 */

import { useState } from "react";
import { useRouter } from "../../i18n/navigation";

const LAUNCH_MS = 900;
const STAGE_W = 200;
const STAGE_H = 240;

export interface RocketLauncherProps {
    readonly cta: string;
    readonly hint: string;
    readonly chargingHint: string;
    readonly launchedHint: string;
    readonly formLinkLabel: string;
    readonly formHref: "/intake/form";
    readonly chatHref: "/intake/upload" | "/intake/chat";
}

export function RocketLauncher(props: RocketLauncherProps): React.ReactElement {
    const router = useRouter();
    const [phase, setPhase] = useState<"idle" | "launching">("idle");

    const launch = () => {
        if (phase !== "idle") return;
        setPhase("launching");
        window.setTimeout(() => {
            router.push(props.chatHref);
        }, LAUNCH_MS - 100);
    };

    const labelByPhase =
        phase === "launching" ? props.launchedHint : props.hint;

    return (
        <div className="relative z-[60] mx-auto flex w-full max-w-md flex-col items-center gap-4">
            <div
                className="relative"
                style={{ width: STAGE_W, height: STAGE_H }}
            >
                <div
                    className={`rocket-stage absolute inset-0 ${phase === "launching" ? "rocket-stage--launching" : ""
                        }`}
                >
                    <RocketSvg phase={phase} />
                </div>
            </div>

            <button
                type="button"
                onClick={launch}
                disabled={phase === "launching"}
                className="text-text-on-primary px-8 py-3 text-base font-semibold transition-transform active:scale-95 disabled:opacity-60"
                style={{
                    background: "var(--gradient-primary)",
                    color: "var(--color-text-on-primary)",
                    borderRadius: "var(--radius-button)",
                    boxShadow: "var(--shadow-clay-primary)",
                }}
            >
                {phase === "launching" ? props.launchedHint : props.cta}
            </button>

            <p
                className="text-text-muted text-xs transition-colors"
                style={{
                    color:
                        phase === "launching"
                            ? "var(--color-primary-from)"
                            : "var(--color-text-muted)",
                }}
            >
                {labelByPhase}
            </p>

            <a
                href={props.formHref}
                onClick={(e) => {
                    e.preventDefault();
                    router.push(props.formHref);
                }}
                className="text-text-muted hover:text-text fixed bottom-6 right-6 text-xs underline decoration-dotted underline-offset-4 transition-colors"
            >
                {props.formLinkLabel}
            </a>

            {/* Curtain overlay during launch — fades the page out so the
                navigation feels like a transition rather than a hard cut. */}
            <div
                aria-hidden
                className="pointer-events-none fixed inset-0 transition-opacity"
                style={{
                    background: "var(--color-bg)",
                    opacity: phase === "launching" ? 1 : 0,
                    transitionDuration: `${LAUNCH_MS}ms`,
                    zIndex: 50,
                }}
            />

            <style jsx>{`
                @keyframes rocket-bob {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-6px); }
                }
                .rocket-stage {
                    animation: rocket-bob 2.4s ease-in-out infinite;
                    will-change: transform;
                }
                .rocket-stage--launching {
                    animation: none;
                    transform: translateY(-720px) scale(0.5);
                    transition: transform ${LAUNCH_MS}ms cubic-bezier(0.55, 0, 0.35, 1);
                }
                @media (prefers-reduced-motion: reduce) {
                    .rocket-stage { animation: none; }
                }
            `}</style>
        </div>
    );
}

function RocketSvg({
    phase,
}: {
    phase: "idle" | "launching";
}): React.ReactElement {
    const flameOpacity = phase === "launching" ? 1 : 0.35;
    const flameScale = phase === "launching" ? 1.6 : 0.5;

    return (
        <svg
            viewBox="0 0 240 360"
            width="100%"
            height="100%"
            aria-hidden
            style={{
                transition: "transform 120ms ease-out",
                filter:
                    phase === "launching"
                        ? "drop-shadow(0 0 24px rgba(255,180,80,0.6))"
                        : "drop-shadow(0 8px 12px rgba(60,30,8,0.18))",
            }}
        >
            <defs>
                <linearGradient id="rkt-body" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#fffaf0" />
                    <stop offset="55%" stopColor="#ffe5d2" />
                    <stop offset="100%" stopColor="#d0a987" />
                </linearGradient>
                <linearGradient id="rkt-nose" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#e8a98a" />
                    <stop offset="100%" stopColor="#a55d34" />
                </linearGradient>
                <linearGradient id="rkt-fin" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#d97757" />
                    <stop offset="100%" stopColor="#a55d34" />
                </linearGradient>
                <radialGradient id="rkt-window" cx="0.4" cy="0.4" r="0.7">
                    <stop offset="0%" stopColor="#cfeaff" />
                    <stop offset="60%" stopColor="#88c0ff" />
                    <stop offset="100%" stopColor="#3a6fa0" />
                </radialGradient>
                <linearGradient id="rkt-flame" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fff0c8" />
                    <stop offset="40%" stopColor="#ffd07a" />
                    <stop offset="100%" stopColor="rgba(217,119,87,0)" />
                </linearGradient>
            </defs>

            {/* Exhaust flame — anchored below the booster, grows with charge */}
            <g
                transform={`translate(120 282) scale(${flameScale} ${flameScale})`}
                style={{ opacity: flameOpacity, transition: "opacity 120ms" }}
            >
                <path
                    d="M -28 0 Q -18 32 -10 56 Q -4 80 0 96 Q 4 80 10 56 Q 18 32 28 0 Z"
                    fill="url(#rkt-flame)"
                />
                <path
                    d="M -14 0 Q -8 22 -4 40 Q 0 60 0 70 Q 0 60 4 40 Q 8 22 14 0 Z"
                    fill="#fff5e0"
                    opacity={0.85}
                />
                {phase === "launching" && (
                    <>
                        <circle cx={-20} cy={40} r={3} fill="#ffd07a" opacity={0.8} />
                        <circle cx={22} cy={56} r={2.4} fill="#ffd07a" opacity={0.7} />
                        <circle cx={-6} cy={78} r={2} fill="#fff0c8" opacity={0.7} />
                    </>
                )}
            </g>

            {/* Ground shadow */}
            <ellipse
                cx={120}
                cy={336}
                rx={phase === "launching" ? 28 : 60}
                ry={phase === "launching" ? 3 : 6}
                fill="#3a1d08"
                opacity={phase === "launching" ? 0.06 : 0.18}
            />

            {/* Fins */}
            <path d="M 78 240 L 78 280 L 50 296 L 60 240 Z" fill="url(#rkt-fin)" />
            <path d="M 162 240 L 162 280 L 190 296 L 180 240 Z" fill="url(#rkt-fin)" />

            {/* Booster ring */}
            <rect x={96} y={260} width={48} height={22} rx={6} fill="#a55d34" />
            <rect x={104} y={264} width={32} height={4} rx={2} fill="#3a1d08" opacity={0.4} />

            {/* Main body */}
            <path
                d="M 84 100 Q 84 80 96 70 L 144 70 Q 156 80 156 100 L 156 260 L 84 260 Z"
                fill="url(#rkt-body)"
            />
            <path
                d="M 144 70 Q 156 80 156 100 L 156 260 L 144 260 L 144 70 Z"
                fill="#3a1d08"
                opacity={0.12}
            />

            {/* Nose cone */}
            <path d="M 84 100 Q 120 14 156 100 Z" fill="url(#rkt-nose)" />
            <path
                d="M 120 14 Q 138 50 156 100 L 144 100 Q 132 56 120 22 Z"
                fill="#3a1d08"
                opacity={0.18}
            />

            {/* Window */}
            <circle cx={120} cy={150} r={22} fill="#3a1d08" opacity={0.55} />
            <circle cx={120} cy={150} r={18} fill="url(#rkt-window)" />
            <ellipse cx={113} cy={143} rx={6} ry={4} fill="#fffaf0" opacity={0.85} />

            {/* Banner stripe */}
            <rect x={84} y={196} width={72} height={14} fill="#d97757" />
            <text
                x={120}
                y={207}
                textAnchor="middle"
                fontFamily="ui-sans-serif, system-ui, sans-serif"
                fontWeight={700}
                fontSize={10}
                fill="#fffaf0"
            >
                ISP0526
            </text>

            {/* Rivets */}
            {[110, 140, 170, 200, 230].map((y) => (
                <g key={y}>
                    <circle cx={92} cy={y} r={1.6} fill="#3a1d08" opacity={0.45} />
                    <circle cx={148} cy={y} r={1.6} fill="#3a1d08" opacity={0.45} />
                </g>
            ))}
        </svg>
    );
}
