// WeChat-friendly share poster. Renders a 750x1334 PNG that resolves to a
// vertical card with the report code, three university name tiles, and a
// short QR-style call to action telling the recipient to ask the original
// sender for the link. We use satori (JSX -> SVG) then resvg (SVG -> PNG)
// because Next.js's built-in ImageResponse uses the Edge runtime and
// breaks on @react-pdf's Node-only deps that also live in this report.
//
// Returns 404 if the code does not resolve to a stored report.

import { NextResponse } from "next/server";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import type { ReactElement } from "react";
import { loadReport } from "../../../../lib/report-store";
import { loadNotoSansSc } from "../../../../lib/fonts/noto-sans-sc";

export const runtime = "nodejs";

interface RouteContext {
    readonly params: Promise<{ code: string }>;
}

export async function GET(
    _req: Request,
    context: RouteContext,
): Promise<Response> {
    const { code } = await context.params;
    const snapshot = await loadReport(code);
    if (!snapshot) {
        return new NextResponse("not found", { status: 404 });
    }

    const allScores = [
        ...snapshot.set.match,
        ...snapshot.set.stretch,
        ...snapshot.set.safety,
    ];
    const tiles = allScores
        .slice(0, 3)
        .map((score) => {
            const candidate = snapshot.candidates.get(score.program_id);
            return {
                uni: candidate?.university.name_zh ?? "—",
                prog: candidate?.program.name_zh ?? "—",
                band: score.band,
            };
        });

    const fontData = await loadNotoSansSc();
    const svg = await satori(buildTree(snapshot.code, tiles), {
        width: 750,
        height: 1334,
        fonts: [
            {
                name: "Noto Sans SC",
                data: fontData,
                weight: 400,
                style: "normal",
            },
        ],
    });

    const png = new Resvg(svg, {
        fitTo: { mode: "width", value: 750 },
    })
        .render()
        .asPng();

    return new NextResponse(new Uint8Array(png), {
        status: 200,
        headers: {
            "Content-Type": "image/png",
            "Cache-Control": "public, max-age=300",
            "Content-Disposition": `inline; filename="poster-${snapshot.code}.png"`,
        },
    });
}

type Tile = { uni: string; prog: string; band: "match" | "stretch" | "safety" };

function bandLabel(band: Tile["band"]): string {
    if (band === "match") return "主推";
    if (band === "stretch") return "冲一冲";
    return "保底";
}

function buildTree(code: string, tiles: ReadonlyArray<Tile>): ReactElement {
    return {
        type: "div",
        key: null,
        props: {
            style: {
                width: "750px",
                height: "1334px",
                display: "flex",
                flexDirection: "column",
                padding: "72px 56px",
                background: "linear-gradient(180deg, #f4f0ea 0%, #ece4d6 100%)",
                fontFamily: "Noto Sans SC",
                color: "#1a1f2e",
            },
            children: [
                {
                    type: "div",
                    key: "brand",
                    props: {
                        style: {
                            display: "flex",
                            fontSize: "28px",
                            letterSpacing: "8px",
                            color: "#7a7466",
                        },
                        children: "ISP0526",
                    },
                },
                {
                    type: "div",
                    key: "title",
                    props: {
                        style: {
                            display: "flex",
                            marginTop: "24px",
                            fontSize: "60px",
                            fontWeight: 700,
                            lineHeight: 1.15,
                        },
                        children: "我的澳洲院校清单",
                    },
                },
                {
                    type: "div",
                    key: "code",
                    props: {
                        style: {
                            display: "flex",
                            marginTop: "20px",
                            fontSize: "26px",
                            color: "#7a7466",
                            letterSpacing: "2px",
                        },
                        children: `报告码 · ${code}`,
                    },
                },
                {
                    type: "div",
                    key: "tiles",
                    props: {
                        style: {
                            display: "flex",
                            flexDirection: "column",
                            marginTop: "72px",
                            gap: "28px",
                        },
                        children: tiles.length
                            ? tiles.map((t, i) => renderTile(t, i))
                            : [renderEmpty()],
                    },
                },
                {
                    type: "div",
                    key: "footer",
                    props: {
                        style: {
                            display: "flex",
                            flexDirection: "column",
                            marginTop: "auto",
                            paddingTop: "48px",
                            fontSize: "24px",
                            color: "#7a7466",
                            lineHeight: 1.6,
                        },
                        children: [
                            {
                                type: "div",
                                key: "f1",
                                props: {
                                    style: { display: "flex" },
                                    children: "向我索要完整报告链接",
                                },
                            },
                            {
                                type: "div",
                                key: "f2",
                                props: {
                                    style: {
                                        display: "flex",
                                        marginTop: "8px",
                                    },
                                    children: "所有结论可追溯，可核查",
                                },
                            },
                        ],
                    },
                },
            ],
        },
    } as ReactElement;
}

function renderTile(tile: Tile, i: number): ReactElement {
    return {
        type: "div",
        key: `tile-${i}`,
        props: {
            style: {
                display: "flex",
                flexDirection: "column",
                padding: "28px 32px",
                background: "#ffffff",
                borderRadius: "32px",
                boxShadow: "0 12px 32px rgba(122,116,102,0.18)",
            },
            children: [
                {
                    type: "div",
                    key: "band",
                    props: {
                        style: {
                            display: "flex",
                            fontSize: "22px",
                            color: "#a89d85",
                            letterSpacing: "2px",
                        },
                        children: bandLabel(tile.band),
                    },
                },
                {
                    type: "div",
                    key: "uni",
                    props: {
                        style: {
                            display: "flex",
                            marginTop: "10px",
                            fontSize: "36px",
                            fontWeight: 700,
                        },
                        children: tile.uni,
                    },
                },
                {
                    type: "div",
                    key: "prog",
                    props: {
                        style: {
                            display: "flex",
                            marginTop: "8px",
                            fontSize: "24px",
                            color: "#4a4438",
                        },
                        children: tile.prog,
                    },
                },
            ],
        },
    } as ReactElement;
}

function renderEmpty(): ReactElement {
    return {
        type: "div",
        key: "empty",
        props: {
            style: {
                display: "flex",
                padding: "40px",
                background: "#ffffff",
                borderRadius: "32px",
                fontSize: "26px",
                color: "#7a7466",
            },
            children: "报告中暂未生成推荐",
        },
    } as ReactElement;
}
