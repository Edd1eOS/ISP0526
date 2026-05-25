import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { loadReport } from "../../../../lib/report-store";
import {
    ReportPdfDocument,
    registerChineseFont,
} from "../../../../features/report/report-pdf";
import { getNotoSansScStablePath } from "../../../../lib/fonts/noto-sans-sc";

// reason: react-pdf relies on node Buffer / fs / fetch; force the Node.js
// runtime so this route never gets compiled into the Edge bundle.
export const runtime = "nodejs";

interface RouteContext {
    readonly params: Promise<{ readonly code: string }>;
}

export async function GET(
    _request: Request,
    context: RouteContext,
): Promise<Response> {
    const { code } = await context.params;
    const snapshot = await loadReport(code);
    if (!snapshot) {
        return new NextResponse("Report not found", { status: 404 });
    }

    const sections = [
        { key: "match", title: "Match · 主推", scores: snapshot.set.match },
        { key: "stretch", title: "Stretch · 冲一冲", scores: snapshot.set.stretch },
        { key: "safety", title: "Safety · 保底", scores: snapshot.set.safety },
    ];

    registerChineseFont(await getNotoSansScStablePath());

    const document = ReportPdfDocument({
        code: snapshot.code,
        createdAt: snapshot.created_at,
        profile: snapshot.profile,
        sections,
        candidates: snapshot.candidates,
        narratives: snapshot.narratives,
    });

    const buffer = await renderToBuffer(document);
    const bytes = new Uint8Array(buffer);

    return new NextResponse(bytes, {
        status: 200,
        headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `inline; filename="report-${snapshot.code}.pdf"`,
            "Cache-Control": "private, max-age=0, must-revalidate",
        },
    });
}
