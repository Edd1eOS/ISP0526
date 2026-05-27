"use client";

import { useEffect, useRef, useState } from "react";
import type { Country, VisaRoute, VisaRouteMap } from "@isp0526/core";

interface JourneyMapProps {
    readonly countries: ReadonlyArray<Country>;
    readonly routes: VisaRouteMap;
    readonly countryLabels: Readonly<Record<Country, string>>;
}

// Equirectangular projection: x = (lon + 180) / 360 * W, y = (90 - lat) / 180 * H.
// Using a 1000x500 viewBox so 2:1 aspect ratio matches the projection.
const VIEW_W = 1000;
const VIEW_H = 500;
function project(lon: number, lat: number): { x: number; y: number } {
    return {
        x: ((lon + 180) / 360) * VIEW_W,
        y: ((90 - lat) / 180) * VIEW_H,
    };
}
const ORIGIN = project(116.4, 39.9); // Beijing
const TARGETS: Record<Country, { x: number; y: number }> = {
    UK: project(-0.1, 51.5), // London
    CA: project(-79.4, 43.7), // Toronto
    US: project(-74, 40.7), // New York
    HK: project(114.2, 22.3),
    SG: project(103.8, 1.3),
    AU: project(151.2, -33.9), // Sydney
    NZ: project(174.8, -36.8), // Auckland
    MY: project(101.7, 3.1), // Kuala Lumpur
    TH: project(100.5, 13.8), // Bangkok
    DE: project(11.6, 48.1), // Munich
    NL: project(4.9, 52.4), // Amsterdam
    IE: project(-6.3, 53.3), // Dublin
    RU: project(37.6, 55.8), // Moscow
    TW: project(121.6, 25.0), // Taipei
    MO: project(113.5, 22.2), // Macau
};

function arcPath(tx: number, ty: number): string {
    // Bulge perpendicular to the Beijing-target line, scaled by distance.
    // Sign chosen so the arc always bulges toward the top of the map.
    const dx = tx - ORIGIN.x;
    const dy = ty - ORIGIN.y;
    const dist = Math.hypot(dx, dy) || 1;
    const mx = (ORIGIN.x + tx) / 2;
    const my = (ORIGIN.y + ty) / 2;
    const px = -dy / dist;
    const py = dx / dist;
    const bulge = Math.min(90, dist * 0.22);
    const sign = py <= 0 ? 1 : -1;
    const cx = mx + px * bulge * sign;
    const cy = my + py * bulge * sign;
    return `M ${ORIGIN.x} ${ORIGIN.y} Q ${cx} ${cy} ${tx} ${ty}`;
}

export function JourneyMap({ countries, routes, countryLabels }: JourneyMapProps) {
    const [openCountry, setOpenCountry] = useState<Country | null>(null);
    const wrapRef = useRef<HTMLDivElement | null>(null);

    const items = countries
        .map((c) => ({ country: c, route: routes[c], pos: TARGETS[c] }))
        .filter(
            (i): i is { country: Country; route: VisaRoute; pos: { x: number; y: number } } =>
                Boolean(i.route) && Boolean(i.pos),
        );

    useEffect(() => {
        if (!openCountry) return;
        function onDocClick(e: MouseEvent) {
            const target = e.target as Element | null;
            if (!wrapRef.current || !target) return;
            if (target.closest("[data-jm-popover]")) return;
            if (target.closest("[data-jm-pin]")) return;
            setOpenCountry(null);
        }
        function onEsc(e: KeyboardEvent) {
            if (e.key === "Escape") setOpenCountry(null);
        }
        document.addEventListener("mousedown", onDocClick);
        document.addEventListener("keydown", onEsc);
        return () => {
            document.removeEventListener("mousedown", onDocClick);
            document.removeEventListener("keydown", onEsc);
        };
    }, [openCountry]);

    if (items.length === 0) return null;

    return (
        <section className="space-y-5">
            <div className="space-y-1.5">
                <h2 className="text-text text-xl font-semibold">
                    正在为你匹配合适的留学起点…
                </h2>
                <p className="text-text-muted text-sm">
                    从北京出发，连线下列目的地。点击地标查看该国签证流程与申请节奏。
                </p>
            </div>

            <div
                ref={wrapRef}
                className="relative overflow-visible"
                style={{
                    background:
                        "radial-gradient(circle at 18% 42%, rgba(251,191,36,0.22), transparent 55%), radial-gradient(circle at 82% 58%, rgba(96,165,250,0.18), transparent 60%), var(--gradient-raised)",
                    borderRadius: "var(--radius-card-md)",
                    boxShadow: "var(--shadow-clay-card)",
                }}
            >
                <svg
                    viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
                    className="block h-auto w-full"
                    role="img"
                    aria-label="Journey map from Beijing to study destinations"
                >
                    <defs>
                        <linearGradient id="jm-arc" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.95" />
                            <stop offset="100%" stopColor="#f97316" stopOpacity="0.9" />
                        </linearGradient>
                        <radialGradient id="jm-origin" cx="50%" cy="50%" r="50%">
                            <stop offset="0%" stopColor="#fde68a" />
                            <stop offset="100%" stopColor="#f59e0b" />
                        </radialGradient>
                        <pattern
                            id="jm-dots"
                            x="0"
                            y="0"
                            width="14"
                            height="14"
                            patternUnits="userSpaceOnUse"
                        >
                            <circle
                                cx="1"
                                cy="1"
                                r="0.9"
                                fill="currentColor"
                                fillOpacity="0.18"
                            />
                        </pattern>
                    </defs>

                    {/* dotted ocean field */}
                    <rect
                        x="0"
                        y="0"
                        width={VIEW_W}
                        height={VIEW_H}
                        fill="url(#jm-dots)"
                        className="text-text-muted"
                    />

                    {/* Simplified continent silhouettes drawn in equirectangular space.
                        Low-poly but geographically anchored — Beijing now lives in
                        East Asia, London in Western Europe, Sydney in Australia, etc. */}
                    <g className="text-text-muted" fillOpacity="0.18" fill="currentColor">
                        {/* Eurasia (Europe + Asia, including British Isles + Japan) */}
                        <path d="M 470 95 L 520 78 L 600 65 L 720 55 L 820 60 L 920 70 L 985 85 L 990 110 L 950 130 L 905 150 L 880 170 L 855 195 L 830 215 L 790 235 L 745 240 L 705 230 L 680 215 L 645 215 L 615 195 L 580 175 L 545 160 L 510 152 L 485 145 L 472 132 L 478 110 Z" />
                        {/* British Isles */}
                        <ellipse cx="492" cy="118" rx="10" ry="14" />
                        {/* Japan */}
                        <path d="M 895 145 L 905 138 L 912 148 L 905 165 L 895 168 Z" />
                        {/* Africa */}
                        <path d="M 478 145 L 545 158 L 590 170 L 625 195 L 640 230 L 615 285 L 595 330 L 555 360 L 520 355 L 495 305 L 470 250 L 460 200 L 465 170 Z" />
                        {/* North America */}
                        <path d="M 110 95 L 180 70 L 260 60 L 320 75 L 360 100 L 370 145 L 355 175 L 330 200 L 295 220 L 260 240 L 220 250 L 195 240 L 165 220 L 140 195 L 120 165 L 105 130 Z" />
                        {/* Greenland */}
                        <path d="M 380 60 L 420 55 L 435 85 L 420 110 L 395 115 L 378 95 Z" />
                        {/* South America */}
                        <path d="M 270 245 L 320 250 L 360 270 L 385 320 L 370 370 L 340 410 L 310 440 L 285 425 L 275 380 L 265 330 L 268 285 Z" />
                        {/* Australia */}
                        <path d="M 815 335 L 870 325 L 920 335 L 935 360 L 920 385 L 870 395 L 825 388 L 810 365 Z" />
                        {/* New Zealand (two small islands) */}
                        <ellipse cx="975" cy="388" rx="6" ry="10" />
                        <ellipse cx="982" cy="408" rx="5" ry="9" />
                    </g>

                    {/* arcs */}
                    {items.map(({ country, pos }, i) => (
                        <ArcPath key={country} d={arcPath(pos.x, pos.y)} delayMs={i * 220} />
                    ))}

                    {/* origin */}
                    <g>
                        <circle
                            cx={ORIGIN.x}
                            cy={ORIGIN.y}
                            r="16"
                            fill="url(#jm-origin)"
                            opacity="0.35"
                        >
                            <animate
                                attributeName="r"
                                values="14;22;14"
                                dur="2.4s"
                                repeatCount="indefinite"
                            />
                            <animate
                                attributeName="opacity"
                                values="0.4;0.1;0.4"
                                dur="2.4s"
                                repeatCount="indefinite"
                            />
                        </circle>
                        <circle cx={ORIGIN.x} cy={ORIGIN.y} r="6.5" fill="url(#jm-origin)" />
                        <text
                            x={ORIGIN.x}
                            y={ORIGIN.y + 26}
                            textAnchor="middle"
                            fontSize="12"
                            fontWeight="700"
                            fill="currentColor"
                            className="text-text"
                        >
                            北京
                        </text>
                    </g>
                </svg>

                {/* Landmark pins as absolutely positioned buttons */}
                {items.map(({ country, route, pos }, i) => {
                    const leftPct = (pos.x / VIEW_W) * 100;
                    const topPct = (pos.y / VIEW_H) * 100;
                    const isOpen = openCountry === country;
                    return (
                        <LandmarkPin
                            key={country}
                            country={country}
                            label={countryLabels[country]}
                            route={route}
                            leftPct={leftPct}
                            topPct={topPct}
                            delayMs={i * 220 + 900}
                            open={isOpen}
                            onToggle={() =>
                                setOpenCountry((cur) => (cur === country ? null : country))
                            }
                        />
                    );
                })}
            </div>

            <style>{`
                @keyframes jm-draw {
                    from { stroke-dashoffset: var(--jm-len); opacity: 0; }
                    20%  { opacity: 1; }
                    to   { stroke-dashoffset: 0; opacity: 1; }
                }
                @keyframes jm-pin-in {
                    0%   { transform: translate(-50%, -100%) scale(0.4); opacity: 0; }
                    60%  { transform: translate(-50%, -100%) scale(1.12); opacity: 1; }
                    100% { transform: translate(-50%, -100%) scale(1); opacity: 1; }
                }
                @keyframes jm-pin-bob {
                    0%, 100% { transform: translate(-50%, -100%) translateY(0); }
                    50%      { transform: translate(-50%, -100%) translateY(-3px); }
                }
                @keyframes jm-pop-in {
                    from { opacity: 0; transform: scale(0.92); }
                    to   { opacity: 1; transform: scale(1); }
                }
            `}</style>
        </section>
    );
}

function ArcPath({ d, delayMs }: { d: string; delayMs: number }) {
    const ref = useRef<SVGPathElement | null>(null);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const len = el.getTotalLength();
        el.style.setProperty("--jm-len", `${len}`);
        el.style.strokeDasharray = `${len}`;
        el.style.strokeDashoffset = `${len}`;
        el.style.opacity = "0";
        el.style.animation = `jm-draw 1.4s cubic-bezier(.4,.0,.2,1) ${delayMs}ms forwards`;
    }, [d, delayMs]);
    return (
        <path
            ref={ref}
            d={d}
            fill="none"
            stroke="url(#jm-arc)"
            strokeWidth="2"
            strokeLinecap="round"
        />
    );
}

interface LandmarkPinProps {
    readonly country: Country;
    readonly label: string;
    readonly route: VisaRoute;
    readonly leftPct: number;
    readonly topPct: number;
    readonly delayMs: number;
    readonly open: boolean;
    readonly onToggle: () => void;
}

function LandmarkPin({
    country,
    label,
    route,
    leftPct,
    topPct,
    delayMs,
    open,
    onToggle,
}: LandmarkPinProps) {
    // Pop direction: away from the closer edges so the panel stays in view.
    const popRight = leftPct > 60;
    const popUp = topPct > 60;

    return (
        <div
            className="absolute"
            style={{ left: `${leftPct}%`, top: `${topPct}%`, zIndex: open ? 30 : 10 }}
        >
            <button
                type="button"
                data-jm-pin
                onClick={onToggle}
                aria-label={`${label} 签证与申请节奏`}
                aria-expanded={open}
                className="group cursor-pointer focus:outline-none"
                style={{
                    transform: "translate(-50%, -100%)",
                    animation: `jm-pin-in 520ms cubic-bezier(.34,1.56,.64,1) ${delayMs}ms backwards, jm-pin-bob 3.6s ease-in-out ${delayMs + 600}ms infinite`,
                }}
            >
                <span className="flex flex-col items-center gap-1">
                    <span
                        className="flex h-12 w-12 items-center justify-center transition-transform group-hover:scale-110 group-focus-visible:scale-110"
                        style={{
                            background: "var(--gradient-primary)",
                            borderRadius: "999px",
                            boxShadow: open
                                ? "0 0 0 4px rgba(251,191,36,0.45), var(--shadow-clay-primary)"
                                : "0 0 0 3px rgba(255,255,255,0.65), var(--shadow-clay-primary)",
                            color: "#fff",
                        }}
                    >
                        <Landmark country={country} />
                    </span>
                    <span
                        className="text-text rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap"
                        style={{
                            background: "rgba(255,255,255,0.88)",
                            backdropFilter: "blur(4px)",
                        }}
                    >
                        {label}
                    </span>
                </span>
            </button>

            {open && (
                <div
                    data-jm-popover
                    role="dialog"
                    aria-label={`${label} 签证详情`}
                    className="bg-surface text-text absolute w-72 space-y-3 p-4"
                    style={{
                        // Anchor to the pin position; offset to the side that keeps it onscreen.
                        left: popRight ? "auto" : "14px",
                        right: popRight ? "14px" : "auto",
                        bottom: popUp ? "8px" : "auto",
                        top: popUp ? "auto" : "8px",
                        borderRadius: "var(--radius-card-md)",
                        boxShadow: "var(--shadow-clay-card)",
                        transformOrigin: `${popRight ? "right" : "left"} ${popUp ? "bottom" : "top"}`,
                        animation: "jm-pop-in 180ms ease-out",
                    }}
                >
                    <header className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5">
                            <p className="text-text-muted text-[10px]">
                                {country} · {route.country_name_zh}
                            </p>
                            <h3 className="text-text text-sm font-semibold">
                                {label} · {route.visa_class}
                            </h3>
                        </div>
                        <button
                            type="button"
                            onClick={onToggle}
                            aria-label="关闭"
                            className="text-text-muted hover:text-text -mr-1 -mt-1 text-lg leading-none"
                        >
                            ×
                        </button>
                    </header>

                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <Stat label="典型周期" value={`${route.total_weeks_typical} 周`} />
                        <Stat
                            label="毕业工签"
                            value={`${route.post_study_work_years} 年`}
                        />
                    </div>

                    <section className="space-y-1.5">
                        <h4 className="text-text text-xs font-semibold">申请节奏</h4>
                        <ol className="space-y-1.5">
                            {route.steps.map((step, idx) => {
                                const pct =
                                    (step.weeks / route.total_weeks_typical) * 100;
                                return (
                                    <li key={step.id} className="space-y-0.5">
                                        <div className="flex justify-between text-[11px]">
                                            <span className="truncate">
                                                {idx + 1}. {step.name_en}
                                            </span>
                                            <span className="text-text-muted ml-2 shrink-0">
                                                ~{step.weeks}w
                                            </span>
                                        </div>
                                        <div
                                            className="h-1.5 w-full overflow-hidden rounded-full"
                                            style={{
                                                background: "var(--color-surface-alt)",
                                            }}
                                        >
                                            <div
                                                className="h-full"
                                                style={{
                                                    width: `${Math.max(6, pct)}%`,
                                                    background:
                                                        "var(--gradient-primary)",
                                                }}
                                            />
                                        </div>
                                    </li>
                                );
                            })}
                        </ol>
                    </section>

                    <p className="text-text-muted text-[10px]">
                        来源：{route.source.source_id}
                        {route.source.last_verified_date
                            ? ` · ${route.source.last_verified_date}`
                            : ""}
                    </p>
                </div>
            )}
        </div>
    );
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div
            className="space-y-0.5 px-2.5 py-1.5"
            style={{
                background: "var(--color-surface-alt)",
                borderRadius: "var(--radius-card-md)",
            }}
        >
            <p className="text-text-muted text-[9px]">{label}</p>
            <p className="text-text text-xs font-semibold">{value}</p>
        </div>
    );
}

// Simplified landmark silhouettes in a 24x24 viewBox. Stylised symbols only.
function Landmark({ country }: { country: Country }) {
    const common = {
        width: 26,
        height: 26,
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "#fff",
        strokeWidth: 1.4,
        strokeLinecap: "round" as const,
        strokeLinejoin: "round" as const,
    };
    switch (country) {
        case "AU":
            return (
                <svg {...common}>
                    <path d="M3 20 H21" />
                    <path d="M5 20 C 5 13, 9 10, 11 13 L 11 20 Z" fill="#fff" />
                    <path d="M9 20 C 9 11, 14 8, 16 12 L 16 20 Z" fill="#fff" />
                    <path d="M14 20 C 14 13, 18 11, 20 14 L 20 20 Z" fill="#fff" />
                </svg>
            );
        case "UK":
            return (
                <svg {...common}>
                    <path d="M12 1.5 L12 4.5" />
                    <rect x="10.5" y="4.5" width="3" height="3" fill="#fff" />
                    <rect x="9.5" y="7.5" width="5" height="5" fill="#fff" />
                    <circle cx="12" cy="10" r="1.5" fill="#f59e0b" />
                    <rect x="9" y="12.5" width="6" height="8.5" fill="#fff" />
                    <path d="M7 21 H17" />
                </svg>
            );
        case "CA":
            return (
                <svg {...common}>
                    <path d="M12 2 L12 7" />
                    <path d="M10.5 7 L13.5 7 L13 9 L11 9 Z" fill="#fff" />
                    <circle cx="12" cy="11" r="2.2" fill="#fff" />
                    <path d="M11.4 13 L12.6 13 L13.5 21 L10.5 21 Z" fill="#fff" />
                    <path d="M6 21 H18" />
                </svg>
            );
        case "US":
            return (
                <svg {...common}>
                    <path d="M5 21 H19" />
                    <path d="M10 21 L10 14 L14 14 L14 21 Z" fill="#fff" />
                    <circle cx="12" cy="10" r="2" fill="#fff" />
                    <path
                        d="M9.4 8.4 L10 6.8 L10.8 8 L11.4 6 L12 8 L12.6 6 L13.2 8 L14 6.8 L14.6 8.4 Z"
                        fill="#fff"
                    />
                    <path d="M14 11 L17 7" />
                    <path d="M17 7 L17.5 5.5 L18.3 7 Z" fill="#fff" />
                </svg>
            );
        case "NZ":
            return (
                <svg {...common}>
                    <path d="M12 2 L12 6" />
                    <circle cx="12" cy="8" r="1.8" fill="#fff" />
                    <path d="M11.3 10 L12.7 10 L13.5 21 L10.5 21 Z" fill="#fff" />
                    <path d="M5 21 H19" />
                </svg>
            );
        case "HK":
            return (
                <svg {...common}>
                    <path d="M3 21 H21" />
                    <path d="M8 21 L8 9 L12 4 L12 21 Z" fill="#fff" />
                    <path d="M12 21 L12 6 L16 11 L16 21 Z" fill="#fff" opacity="0.9" />
                    <path d="M8 9 L12 4 L16 11" />
                    <path d="M8 14 L16 14" />
                    <path d="M8 18 L16 18" />
                </svg>
            );
        case "SG":
            return (
                <svg {...common}>
                    <path d="M3 21 H21" />
                    <rect x="5" y="11" width="2.5" height="10" fill="#fff" />
                    <rect x="10.75" y="11" width="2.5" height="10" fill="#fff" />
                    <rect x="16.5" y="11" width="2.5" height="10" fill="#fff" />
                    <path
                        d="M4 11 C 8 9, 16 9, 20 11 L 20 9 C 16 7, 8 7, 4 9 Z"
                        fill="#fff"
                    />
                </svg>
            );
        default:
            return (
                <svg {...common}>
                    <circle cx="12" cy="12" r="6" fill="#fff" />
                </svg>
            );
    }
}
