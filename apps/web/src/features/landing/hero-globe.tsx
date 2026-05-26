"use client";

/**
 * Hero landing scene: a clay-style globe that actually rotates in place.
 * The continents live on an equirectangular SVG strip rendered twice
 * side-by-side and scrolled horizontally inside a circular clip, so the
 * "back" side of the globe always has land rolling into view. A radial
 * vignette overlays the disk to fake spherical lighting. Landmarks pop
 * up region-by-region in time with the rotation, kangaroos hop along
 * the visible northern arc, and a small shuttle bobs overhead.
 */

/* -------- strip geometry -------- */

const STRIP_W = 640; // covers 360 deg of longitude
const STRIP_H = 320; // covers 180 deg of latitude
const EARTH_CX = 400;
const EARTH_CY = 360;
const EARTH_R = 160;
const STRIP_OFFSET_X = EARTH_CX - STRIP_W / 2; // 80
const STRIP_OFFSET_Y = EARTH_CY - STRIP_H / 2; // 200

type LonLatPoly = Array<[number, number]>;

const CONTINENTS: LonLatPoly[] = [
    // North America
    [
        [-168, 65], [-160, 70], [-140, 70], [-128, 70], [-100, 73], [-80, 73],
        [-65, 60], [-55, 52], [-65, 45], [-70, 42], [-75, 38], [-78, 33],
        [-80, 27], [-82, 25], [-83, 30], [-88, 30], [-90, 29], [-95, 29],
        [-97, 26], [-99, 22], [-105, 22], [-107, 24], [-110, 23], [-115, 30],
        [-118, 33], [-122, 38], [-124, 43], [-124, 48], [-130, 54], [-135, 58],
        [-145, 60], [-155, 58], [-162, 60], [-168, 65],
    ],
    // Central America
    [[-92, 18], [-88, 16], [-83, 9], [-77, 7], [-82, 13], [-87, 15], [-92, 18]],
    // South America
    [
        [-78, 12], [-70, 12], [-60, 8], [-52, 4], [-50, 0], [-44, -2], [-38, -8],
        [-35, -12], [-37, -22], [-43, -23], [-48, -30], [-54, -34], [-58, -38],
        [-65, -42], [-68, -48], [-70, -53], [-72, -55], [-70, -50], [-73, -45],
        [-75, -40], [-72, -35], [-72, -30], [-74, -22], [-78, -15], [-80, -5],
        [-79, 0], [-77, 6], [-78, 12],
    ],
    // Eurasia
    [
        [-10, 36], [-5, 36], [0, 38], [5, 43], [10, 44], [12, 45], [18, 40],
        [25, 38], [28, 36], [34, 31], [35, 25], [38, 22], [42, 16], [46, 13],
        [51, 13], [53, 18], [56, 24], [60, 25], [60, 22], [56, 16], [54, 12],
        [60, 12], [68, 23], [72, 24], [78, 24], [82, 21], [88, 22], [90, 22],
        [88, 18], [86, 12], [82, 8], [80, 5], [80, 13], [83, 16], [78, 18],
        [75, 9], [80, 6], [82, 6], [88, 9], [92, 12], [96, 16], [100, 14],
        [105, 11], [108, 7], [104, 1], [110, 1], [116, 6], [120, 10], [122, 15],
        [120, 22], [122, 27], [121, 32], [120, 39], [124, 41], [129, 41], [130, 38],
        [125, 33], [128, 35], [135, 35], [140, 36], [142, 43], [145, 47], [150, 50],
        [155, 55], [160, 58], [165, 62], [175, 66], [180, 68], [175, 70], [160, 72],
        [140, 73], [120, 73], [100, 75], [80, 75], [60, 72], [50, 70], [40, 68],
        [30, 70], [20, 70], [10, 70], [5, 66], [12, 60], [20, 55], [12, 50],
        [3, 51], [-5, 49], [-10, 44], [-10, 36],
    ],
    // Africa
    [
        [-17, 35], [-10, 35], [-5, 35], [0, 36], [10, 35], [20, 32], [30, 31],
        [35, 30], [42, 16], [48, 12], [50, 8], [44, 5], [42, -2], [40, -10],
        [40, -18], [37, -22], [33, -27], [30, -32], [25, -33], [22, -34],
        [18, -34], [16, -29], [13, -20], [10, -10], [6, -3], [0, 3], [-5, 5],
        [-10, 8], [-14, 12], [-17, 18], [-17, 25], [-17, 35],
    ],
    // Australia
    [
        [113, -22], [115, -33], [120, -34], [125, -34], [130, -32], [136, -35],
        [140, -38], [145, -39], [148, -37], [152, -33], [153, -28], [150, -23],
        [146, -19], [142, -11], [138, -12], [135, -15], [132, -12], [128, -14],
        [125, -14], [122, -17], [115, -22], [113, -22],
    ],
];

const ISLANDS: LonLatPoly[] = [
    // British Isles
    [[-8, 50], [-3, 50], [0, 52], [1, 55], [-2, 58], [-7, 58], [-8, 54], [-8, 50]],
    // Greenland
    [[-55, 60], [-30, 60], [-20, 70], [-22, 80], [-35, 83], [-50, 80], [-55, 70], [-55, 60]],
    // Japan
    [
        [130, 32], [134, 34], [138, 35], [141, 38], [143, 42], [145, 45], [142, 44],
        [138, 38], [134, 35], [130, 32],
    ],
    // Madagascar
    [[44, -12], [50, -16], [50, -22], [46, -25], [43, -22], [44, -12]],
    // Tasmania
    [[144, -41], [147, -41], [148, -43], [145, -44], [144, -41]],
    // New Zealand
    [
        [170, -35], [174, -36], [176, -39], [175, -42], [172, -42], [168, -47],
        [167, -45], [168, -41], [170, -35],
    ],
    // Indonesia (Sumatra/Java/Borneo/Sulawesi/New Guinea)
    [[95, 4], [100, 0], [104, -4], [102, -6], [96, -2], [94, 2], [95, 4]],
    [[105, -6], [113, -7], [115, -8], [112, -9], [106, -8], [105, -6]],
    [[109, 2], [115, 4], [118, 1], [117, -3], [113, -3], [110, -1], [109, 2]],
    [[118, 1], [123, 2], [125, -2], [123, -5], [120, -5], [118, -3], [118, 1]],
    [[131, -3], [140, -3], [150, -7], [148, -10], [138, -9], [132, -8], [131, -3]],
    // Philippines
    [[120, 18], [124, 16], [126, 10], [125, 6], [122, 7], [120, 12], [120, 18]],
    // Iceland
    [[-24, 64], [-15, 64], [-13, 66], [-18, 66], [-24, 66], [-24, 64]],
    // Cuba
    [[-84, 22], [-75, 22], [-74, 20], [-78, 19], [-84, 21], [-84, 22]],
    // Sri Lanka
    [[80, 9], [82, 8], [82, 6], [80, 6], [79, 8], [80, 9]],
];

const BIOMES: Array<{ poly: LonLatPoly; fill: string; opacity: number }> = [
    // Sahara
    {
        poly: [[-10, 30], [25, 30], [35, 22], [25, 16], [10, 18], [-8, 22], [-10, 30]],
        fill: "#c8924a",
        opacity: 0.7,
    },
    // Amazon
    {
        poly: [[-72, 0], [-55, 0], [-48, -8], [-58, -12], [-70, -8], [-72, 0]],
        fill: "#6a7a32",
        opacity: 0.6,
    },
    // Congo
    {
        poly: [[10, 0], [25, 0], [28, -10], [18, -12], [12, -6], [10, 0]],
        fill: "#6a7a32",
        opacity: 0.55,
    },
    // Arabia desert
    {
        poly: [[34, 30], [55, 18], [55, 12], [44, 14], [38, 22], [34, 30]],
        fill: "#c8924a",
        opacity: 0.6,
    },
    // Australian outback
    {
        poly: [[120, -22], [140, -22], [142, -30], [125, -30], [120, -22]],
        fill: "#c8924a",
        opacity: 0.55,
    },
];

const MOUNTAINS: Array<[number, number]> = [
    [78, 30], [82, 30], [86, 30], [90, 28],   // Himalayas
    [-115, 50], [-112, 42], [-108, 38],       // Rockies
    [-72, -10], [-70, -20], [-70, -30],       // Andes
    [8, 46], [12, 46],                         // Alps
];

const ANTARCTICA: LonLatPoly = [
    [-180, -65], [-150, -68], [-120, -70], [-80, -72], [-40, -68], [0, -70],
    [40, -68], [80, -68], [120, -68], [160, -70], [180, -65], [180, -90],
    [-180, -90], [-180, -65],
];

function lonLatToStrip(lon: number, lat: number): [number, number] {
    const x = ((lon + 180) / 360) * STRIP_W;
    const y = ((90 - lat) / 180) * STRIP_H;
    return [x, y];
}

function polyToPath(poly: LonLatPoly): string {
    if (poly.length === 0) return "";
    const parts: string[] = [];
    const first = poly[0]!;
    const [fx, fy] = lonLatToStrip(first[0], first[1]);
    parts.push(`M ${fx.toFixed(1)} ${fy.toFixed(1)}`);
    for (let i = 1; i < poly.length; i++) {
        const p = poly[i]!;
        const [x, y] = lonLatToStrip(p[0], p[1]);
        parts.push(`L ${x.toFixed(1)} ${y.toFixed(1)}`);
    }
    parts.push("Z");
    return parts.join(" ");
}

function ContinentStrip(): React.ReactElement {
    return (
        <g>
            <rect width={STRIP_W} height={STRIP_H} fill="url(#ocean-grad)" />
            {CONTINENTS.map((poly, i) => (
                <path key={`c${i}`} d={polyToPath(poly)} fill="#6e3a18" />
            ))}
            {BIOMES.map((b, i) => (
                <path key={`b${i}`} d={polyToPath(b.poly)} fill={b.fill} opacity={b.opacity} />
            ))}
            {ISLANDS.map((poly, i) => (
                <path key={`i${i}`} d={polyToPath(poly)} fill="#6e3a18" />
            ))}
            <path d={polyToPath(ANTARCTICA)} fill="#fffaf0" opacity={0.92} />
            {MOUNTAINS.map(([lon, lat], i) => {
                const [x, y] = lonLatToStrip(lon, lat);
                return <circle key={`m${i}`} cx={x} cy={y} r={1.8} fill="#3a1d08" />;
            })}
            <ellipse cx={120} cy={70} rx={28} ry={4} fill="rgba(255,250,240,0.45)" />
            <ellipse cx={320} cy={100} rx={36} ry={4} fill="rgba(255,250,240,0.4)" />
            <ellipse cx={500} cy={50} rx={30} ry={3.5} fill="rgba(255,250,240,0.4)" />
            <ellipse cx={240} cy={240} rx={28} ry={3.5} fill="rgba(255,250,240,0.35)" />
        </g>
    );
}

/* -------- clay landmarks + kangaroo + shuttle (SVG) -------- */

function EiffelTower(): React.ReactElement {
    return (
        <g>
            <path d="M -14 0 Q -8 -20 -3 -36 L -2 -36 Q -7 -20 -12 0 Z" fill="#a55d34" />
            <path d="M 14 0 Q 8 -20 3 -36 L 2 -36 Q 7 -20 12 0 Z" fill="#a55d34" />
            <rect x="-12" y="-38" width="24" height="3" fill="#a55d34" />
            <line x1="-12" y1="-1" x2="12" y2="-38" stroke="#7a4220" strokeWidth="0.8" />
            <line x1="12" y1="-1" x2="-12" y2="-38" stroke="#7a4220" strokeWidth="0.8" />
            <path d="M -10 -38 L -4 -64 L 4 -64 L 10 -38 Z" fill="#a55d34" />
            <line x1="-9" y1="-39" x2="9" y2="-63" stroke="#7a4220" strokeWidth="0.7" />
            <line x1="9" y1="-39" x2="-9" y2="-63" stroke="#7a4220" strokeWidth="0.7" />
            <rect x="-5" y="-66" width="10" height="2.5" fill="#a55d34" />
            <path d="M -3 -66 L 0 -92 L 3 -66 Z" fill="#a55d34" />
            <circle cx="0" cy="-96" r="2.5" fill="#ffd07a" />
            <circle cx="0" cy="-96" r="5" fill="#ffd07a" opacity="0.25" />
        </g>
    );
}

function StatueOfLiberty(): React.ReactElement {
    return (
        <g>
            <rect x="-14" y="-18" width="28" height="18" fill="#8c6a4e" />
            <rect x="-11" y="-30" width="22" height="12" fill="#a8836a" />
            <rect x="-9" y="-40" width="18" height="10" fill="#8c6a4e" />
            <rect x="-2" y="-12" width="4" height="8" fill="#3a1d08" />
            <path d="M -10 -40 L 10 -40 L 8 -68 L -8 -68 Z" fill="#a8c8a2" />
            <line x1="-6" y1="-42" x2="-6" y2="-66" stroke="#8aab84" strokeWidth="0.6" />
            <line x1="0" y1="-42" x2="0" y2="-66" stroke="#8aab84" strokeWidth="0.6" />
            <line x1="6" y1="-42" x2="6" y2="-66" stroke="#8aab84" strokeWidth="0.6" />
            <rect x="-7" y="-64" width="9" height="11" fill="#fffaf0" stroke="#8c6a4e" strokeWidth="0.6" />
            <line x1="-6" y1="-61" x2="1" y2="-61" stroke="#8c6a4e" strokeWidth="0.4" />
            <line x1="-6" y1="-58" x2="1" y2="-58" stroke="#8c6a4e" strokeWidth="0.4" />
            <line x1="-6" y1="-55" x2="1" y2="-55" stroke="#8c6a4e" strokeWidth="0.4" />
            <rect x="-9" y="-72" width="18" height="5" fill="#a8c8a2" />
            <rect x="-2" y="-77" width="4" height="3" fill="#a8c8a2" />
            <circle cx="0" cy="-82" r="5" fill="#a8c8a2" />
            {[-3, -1.5, 0, 1.5, 3].map((tx, i) => (
                <path
                    key={i}
                    d={`M ${tx} -86 L ${tx + 0.6} -91 L ${tx + 1.2} -86 Z`}
                    fill="#a8c8a2"
                />
            ))}
            <path d="M 5 -78 Q 12 -86 14 -94" stroke="#a8c8a2" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            <circle cx="14" cy="-95" r="2" fill="#a55d34" />
            <path d="M 14 -97 Q 16 -102 14 -106 Q 12 -102 14 -97 Z" fill="#ffd07a" />
            <circle cx="14" cy="-100" r="6" fill="#ffa84a" opacity="0.3" />
        </g>
    );
}

function SiliconValley(): React.ReactElement {
    return (
        <g>
            <rect x="-22" y="-20" width="2" height="20" fill="#8c6a4e" />
            <path d="M -21 -22 Q -28 -28 -32 -22 Q -28 -24 -21 -22 Z" fill="#6a7a32" />
            <path d="M -21 -22 Q -14 -28 -10 -22 Q -14 -24 -21 -22 Z" fill="#6a7a32" />
            <path d="M -21 -22 Q -24 -32 -18 -34 Q -22 -28 -21 -22 Z" fill="#6a7a32" />
            <path d="M -21 -22 Q -16 -30 -22 -34 Q -22 -28 -21 -22 Z" fill="#6a7a32" />
            <ellipse cx="-2" cy="-6" rx="18" ry="6" fill="#fffaf0" />
            <ellipse cx="-2" cy="-6" rx="11" ry="3.5" fill="#ffefe2" />
            <ellipse cx="-2" cy="-7.5" rx="11" ry="2" fill="#6a7a32" opacity="0.5" />
            {[-14, -10, -6, -2, 2, 6, 10].map((tx, i) => (
                <line key={i} x1={tx} y1="-8" x2={tx} y2="-4" stroke="#a8836a" strokeWidth="0.4" />
            ))}
            <rect x="14" y="-32" width="12" height="32" fill="#a55d34" />
            {[0, 1, 2, 3].map((row) =>
                [0, 1].map((col) => (
                    <rect
                        key={`${row}-${col}`}
                        x={16 + col * 5}
                        y={-28 + row * 7}
                        width="3"
                        height="4"
                        fill="#6a8a64"
                    />
                )),
            )}
            <line x1="20" y1="-32" x2="20" y2="-38" stroke="#3a1d08" strokeWidth="0.8" />
            <circle cx="20" cy="-39" r="1.2" fill="#d97757" />
        </g>
    );
}

function MtFuji(): React.ReactElement {
    return (
        <g>
            <ellipse cx="0" cy="0" rx="36" ry="3" fill="#3a1d08" opacity="0.18" />
            <path d="M -28 -2 Q -22 -16 -14 -2 Z" fill="#7a4220" opacity="0.7" />
            <path d="M 14 -2 Q 22 -16 28 -2 Z" fill="#7a4220" opacity="0.7" />
            <path d="M -22 -2 L 0 -50 L 22 -2 Z" fill="#8c6a4e" />
            <path d="M 0 -50 L 22 -2 L 14 -2 Z" fill="#6e3a18" opacity="0.4" />
            <path
                d="M -8 -36 L -4 -40 L -1 -38 L 0 -50 L 2 -42 L 5 -38 L 8 -36 L 4 -34 L 0 -36 L -4 -34 Z"
                fill="#fffaf0"
            />
            <line x1="-6" y1="-30" x2="6" y2="-30" stroke="#fffaf0" strokeWidth="0.8" opacity="0.7" />
            <line x1="-5" y1="-22" x2="5" y2="-22" stroke="#fffaf0" strokeWidth="0.6" opacity="0.5" />
            <ellipse cx="-26" cy="-4" rx="12" ry="2.5" fill="#fffaf0" opacity="0.8" />
            <ellipse cx="24" cy="-3" rx="10" ry="2.2" fill="#fffaf0" opacity="0.75" />
        </g>
    );
}

function Pagoda(): React.ReactElement {
    return (
        <g>
            <rect x="-14" y="-4" width="28" height="4" fill="#8c6a4e" />
            <rect x="-10" y="-18" width="20" height="14" fill="#d97757" />
            <rect x="-3" y="-14" width="6" height="10" fill="#3a1d08" />
            <rect x="-3.5" y="-15" width="7" height="1.5" fill="#a55d34" />
            <path d="M -14 -18 Q -18 -22 -14 -22 L 14 -22 Q 18 -22 14 -18 Z" fill="#a55d34" />
            <rect x="-8" y="-32" width="16" height="10" fill="#d97757" />
            <rect x="-2.5" y="-30" width="5" height="5" fill="#3a1d08" />
            <path d="M -12 -32 Q -15 -36 -12 -36 L 12 -36 Q 15 -36 12 -32 Z" fill="#a55d34" />
            <rect x="-6" y="-44" width="12" height="8" fill="#d97757" />
            <rect x="-2" y="-42" width="4" height="4" fill="#3a1d08" />
            <path d="M -9 -44 Q -11 -48 -9 -48 L 9 -48 Q 11 -48 9 -44 Z" fill="#a55d34" />
            <rect x="-1" y="-54" width="2" height="6" fill="#a55d34" />
            <circle cx="0" cy="-56" r="2" fill="#ffd07a" />
            <circle cx="0" cy="-60" r="1.2" fill="#ffd07a" />
        </g>
    );
}

function KangarooGfx(): React.ReactElement {
    return (
        <g>
            <ellipse cx="0" cy="2" rx="9" ry="1.5" fill="#3a1d08" opacity="0.25" />
            <path d="M 4 -2 Q 11 0 13 5" stroke="#a55d34" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            <path d="M 2 -3 Q 4 1 6 2 L 8 2 Q 5 -2 4 -4 Z" fill="#a55d34" />
            <path d="M -4 -8 Q 2 -10 4 -4 Q 2 0 -3 -2 Q -7 -4 -4 -8 Z" fill="#a55d34" />
            <ellipse cx="-1" cy="-4" rx="2.5" ry="1.5" fill="#d97757" opacity="0.7" />
            <path d="M -3 -6 Q -5 -4 -4 -2" stroke="#a55d34" strokeWidth="1.6" fill="none" strokeLinecap="round" />
            <path d="M -5 -8 L -7 -11" stroke="#a55d34" strokeWidth="2.5" strokeLinecap="round" />
            <ellipse cx="-8" cy="-12" rx="3" ry="2.4" fill="#a55d34" />
            <ellipse cx="-10" cy="-12" rx="1.4" ry="1" fill="#a55d34" />
            <path d="M -8 -14 L -8.5 -17 L -7 -15 Z" fill="#a55d34" />
            <path d="M -9 -14 L -10 -17 L -8.5 -15 Z" fill="#a55d34" />
            <circle cx="-9" cy="-12" r="0.5" fill="#3a1d08" />
            <circle cx="-11" cy="-12" r="0.4" fill="#3a1d08" />
        </g>
    );
}

function Shuttle(): React.ReactElement {
    return (
        <g transform="translate(540 130) rotate(-18)">
            <path d="M -22 0 L -10 -3 L -10 3 Z" fill="url(#flame-grad)" />
            <rect x="-10" y="-6" width="32" height="12" rx="6" fill="url(#shuttle-grad)" />
            <circle cx="14" cy="0" r="3.2" fill="#88c0ff" />
            <path d="M -2 -6 L 2 -12 L 6 -6 Z" fill="#d97757" />
            <path d="M -2 6 L 2 12 L 6 6 Z" fill="#a55d34" />
            <circle cx="-4" cy="0" r="1.2" fill="#3a1d08" />
        </g>
    );
}

/* -------- main component -------- */

export function HeroGlobe(): React.ReactElement {
    return (
        <div className="relative mx-auto" style={{ maxWidth: 760 }} aria-hidden>
            <svg viewBox="0 0 800 540" className="block h-auto w-full">
                <defs>
                    <radialGradient id="earth-base" cx="0.38" cy="0.32" r="0.85">
                        <stop offset="0%" stopColor="#ffd9b4" />
                        <stop offset="60%" stopColor="#e8a679" />
                        <stop offset="100%" stopColor="#b66a3d" />
                    </radialGradient>
                    <radialGradient id="earth-rim" cx="0.5" cy="0.5" r="0.5">
                        <stop offset="80%" stopColor="rgba(122,66,32,0)" />
                        <stop offset="100%" stopColor="rgba(74,38,12,0.5)" />
                    </radialGradient>
                    <radialGradient id="sphere-light" cx="0.35" cy="0.3" r="0.7">
                        <stop offset="0%" stopColor="rgba(255,240,220,0.55)" />
                        <stop offset="45%" stopColor="rgba(255,240,220,0)" />
                        <stop offset="100%" stopColor="rgba(60,30,8,0.35)" />
                    </radialGradient>
                    <linearGradient id="ocean-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#e8a679" />
                        <stop offset="50%" stopColor="#f0b890" />
                        <stop offset="100%" stopColor="#dc9560" />
                    </linearGradient>
                    <linearGradient id="shuttle-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#fffaf0" />
                        <stop offset="100%" stopColor="#e0c8b0" />
                    </linearGradient>
                    <linearGradient id="flame-grad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="rgba(255,180,80,0)" />
                        <stop offset="100%" stopColor="#ffa84a" />
                    </linearGradient>
                    <clipPath id="earth-clip">
                        <circle cx={EARTH_CX} cy={EARTH_CY} r={EARTH_R} />
                    </clipPath>
                </defs>

                <ellipse cx={EARTH_CX} cy={210} rx={220} ry={44} fill="#ffe5d2" opacity={0.5} />
                <circle cx={EARTH_CX} cy={EARTH_CY} r={EARTH_R} fill="url(#earth-base)" />

                {/* Rotating continent strip clipped to earth disk. Two copies
                    side by side; inner group scrolls -STRIP_W for a seamless
                    loop so the "back" of the globe always has land on its way
                    to becoming the front. */}
                <g clipPath="url(#earth-clip)">
                    <g transform={`translate(${STRIP_OFFSET_X} ${STRIP_OFFSET_Y})`}>
                        <g className="strip">
                            <g transform="translate(0 0)">
                                <ContinentStrip />
                            </g>
                            <g transform={`translate(${STRIP_W} 0)`}>
                                <ContinentStrip />
                            </g>
                        </g>
                    </g>
                </g>

                {/* Sphere lighting overlay + specular + rim shadow */}
                <g clipPath="url(#earth-clip)">
                    <circle cx={EARTH_CX} cy={EARTH_CY} r={EARTH_R} fill="url(#sphere-light)" />
                </g>
                <ellipse cx={345} cy={290} rx={48} ry={20} fill="rgba(255,240,220,0.45)" />
                <circle cx={EARTH_CX} cy={EARTH_CY} r={EARTH_R} fill="url(#earth-rim)" />

                {/* Landmark stages: pop up region-by-region in a 24s cycle */}
                <g className="lm lm-europe" style={{ transformOrigin: "400px 210px" }}>
                    <g transform="translate(400 210)">
                        <EiffelTower />
                    </g>
                </g>
                <g className="lm lm-america" style={{ transformOrigin: "400px 210px" }}>
                    <g transform="translate(370 210)">
                        <StatueOfLiberty />
                    </g>
                    <g transform="translate(440 222)">
                        <SiliconValley />
                    </g>
                </g>
                <g className="lm lm-oceania" style={{ transformOrigin: "400px 200px" }}>
                    <g transform="translate(400 200)">
                        <g className="roo roo-1">
                            <KangarooGfx />
                        </g>
                        <g className="roo roo-2">
                            <KangarooGfx />
                        </g>
                        <g className="roo roo-3">
                            <KangarooGfx />
                        </g>
                    </g>
                </g>
                <g className="lm lm-asia" style={{ transformOrigin: "400px 210px" }}>
                    <g transform="translate(372 212)">
                        <MtFuji />
                    </g>
                    <g transform="translate(434 218)">
                        <Pagoda />
                    </g>
                </g>

                <g className="shuttle">
                    <Shuttle />
                </g>
            </svg>

            <style jsx>{`
                :global(.strip) {
                    animation: stripScroll 36s linear infinite;
                }
                :global(.lm) {
                    opacity: 0;
                    transform: translateY(8px) scale(0.6);
                }
                :global(.lm-europe) {
                    animation: showEurope 24s ease-in-out infinite;
                }
                :global(.lm-america) {
                    animation: showAmerica 24s ease-in-out infinite;
                }
                :global(.lm-oceania) {
                    animation: showOceania 24s linear infinite;
                }
                :global(.lm-asia) {
                    animation: showAsia 24s ease-in-out infinite;
                }
                :global(.roo) {
                    animation: hopAcross 6s ease-in-out infinite;
                }
                :global(.roo-2) {
                    animation-delay: -0.6s;
                }
                :global(.roo-3) {
                    animation-delay: -1.2s;
                }
                :global(.shuttle) {
                    animation: shuttleBob 4.2s ease-in-out infinite;
                }
                @keyframes stripScroll {
                    from { transform: translateX(0); }
                    to { transform: translateX(-${STRIP_W}px); }
                }
                @keyframes shuttleBob {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-8px); }
                }
                @keyframes showEurope {
                    0% { opacity: 0; transform: translateY(12px) scale(0.5); }
                    5% { opacity: 1; transform: translateY(-4px) scale(1.08); }
                    10% { transform: translateY(0) scale(1); }
                    22% { opacity: 1; transform: translateY(0) scale(1); }
                    26% { opacity: 0; transform: translateY(-6px) scale(0.85); }
                    100% { opacity: 0; transform: translateY(12px) scale(0.5); }
                }
                @keyframes showAmerica {
                    0%, 24% { opacity: 0; transform: translateY(12px) scale(0.5); }
                    29% { opacity: 1; transform: translateY(-4px) scale(1.08); }
                    34% { transform: translateY(0) scale(1); }
                    46% { opacity: 1; transform: translateY(0) scale(1); }
                    50% { opacity: 0; transform: translateY(-6px) scale(0.85); }
                    100% { opacity: 0; transform: translateY(12px) scale(0.5); }
                }
                @keyframes showOceania {
                    0%, 48% { opacity: 0; transform: translateY(0) scale(1); }
                    52% { opacity: 1; transform: translateY(0) scale(1); }
                    72% { opacity: 1; transform: translateY(0) scale(1); }
                    76% { opacity: 0; transform: translateY(0) scale(1); }
                    100% { opacity: 0; transform: translateY(0) scale(1); }
                }
                @keyframes showAsia {
                    0%, 73% { opacity: 0; transform: translateY(12px) scale(0.5); }
                    78% { opacity: 1; transform: translateY(-4px) scale(1.08); }
                    83% { transform: translateY(0) scale(1); }
                    95% { opacity: 1; transform: translateY(0) scale(1); }
                    99% { opacity: 0; transform: translateY(-6px) scale(0.85); }
                    100% { opacity: 0; transform: translateY(12px) scale(0.5); }
                }
                /* Kangaroos hop along the visible curve of the northern arc.
                   Container is anchored at (400, 200) = top of globe.
                   Ground formula: dy = 160 - sqrt(160^2 - dx^2). */
                @keyframes hopAcross {
                    0%    { transform: translate(120px, 54px) scaleX(-1); opacity: 0; }
                    5%    { opacity: 1; }
                    12.5% { transform: translate(95px, 12px) scaleX(-1); }
                    25%   { transform: translate(70px, 17px) scaleX(-1); }
                    37.5% { transform: translate(40px, -16px) scaleX(-1); }
                    50%   { transform: translate(0, 0) scaleX(-1); }
                    62.5% { transform: translate(-40px, -16px) scaleX(-1); }
                    75%   { transform: translate(-70px, 17px) scaleX(-1); }
                    87.5% { transform: translate(-95px, 12px) scaleX(-1); }
                    95%   { opacity: 1; }
                    100%  { transform: translate(-120px, 54px) scaleX(-1); opacity: 0; }
                }
                @media (prefers-reduced-motion: reduce) {
                    :global(.strip),
                    :global(.shuttle),
                    :global(.roo),
                    :global(.lm) {
                        animation: none;
                    }
                    :global(.lm-europe) { opacity: 1; transform: none; }
                }
            `}</style>
        </div>
    );
}
