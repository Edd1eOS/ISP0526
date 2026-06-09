import { NextResponse } from "next/server";
import { z } from "zod";
import { generateReportChatReply, getVisaRoutes } from "@isp0526/core";
import { buildGoogleReportChatGenerator } from "../../../../lib/ai/google-report-chat";
import { isGoogleConfigured } from "../../../../lib/ai/google-narrative";
import { loadReport } from "../../../../lib/report-store";

export const runtime = "nodejs";

const RequestSchema = z.object({
    question: z.string().min(1).max(500),
    locale: z.enum(["zh", "en"]).default("zh"),
    history: z
        .array(
            z.object({
                role: z.enum(["user", "assistant"]),
                content: z.string().min(1).max(2000),
            }),
        )
        .max(10)
        .default([]),
});

interface RouteContext {
    readonly params: Promise<{ readonly code: string }>;
}

export async function POST(
    request: Request,
    context: RouteContext,
): Promise<Response> {
    const { code } = await context.params;
    const snapshot = await loadReport(code);
    if (!snapshot) {
        return NextResponse.json({ error: "report_not_found" }, { status: 404 });
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: "invalid_request", details: parsed.error.flatten() },
            { status: 400 },
        );
    }

    if (!isGoogleConfigured()) {
        return NextResponse.json(
            {
                error: "llm_unavailable",
                message:
                    "Chat is disabled in this environment; set GOOGLE_GENERATIVE_AI_API_KEY to enable.",
            },
            { status: 503 },
        );
    }

    const routes = getVisaRoutes();
    const allScores = [
        ...snapshot.set.stretch,
        ...snapshot.set.match,
        ...snapshot.set.safety,
    ];

    const programs = allScores.flatMap((s) => {
        const cand = snapshot.candidates.get(s.program_id);
        if (!cand) return [];
        return [
            {
                program_id: s.program_id,
                university_id: s.university_id,
                band: s.band,
                final_score: Math.round(s.final_score),
                country: cand.university.country,
                city: cand.university.city,
                program_name: cand.program.name_en,
                university_name: cand.university.name_en,
                tuition_annual_aud: cand.program.tuition?.annual,
                tags: cand.program.tags,
                source_ids: [
                    ...cand.program.sources.map((src) => src.source_id),
                    ...cand.university.sources.map((src) => src.source_id),
                ],
            },
        ];
    });

    const countriesInReport = new Set(programs.map((p) => p.country));
    const visas = [...countriesInReport].flatMap((c) => {
        const route = routes[c as keyof typeof routes];
        if (!route) return [];
        return [
            {
                country: c,
                visa_class: route.visa_class,
                total_weeks_typical: route.total_weeks_typical,
                post_study_work_years: route.post_study_work_years,
                source_id: route.source.source_id,
            },
        ];
    });

    const knownSourceIds = new Set<string>();
    for (const p of programs) {
        for (const sid of p.source_ids) knownSourceIds.add(sid);
    }
    for (const v of visas) knownSourceIds.add(v.source_id);

    const result = await generateReportChatReply({
        locale: parsed.data.locale,
        question: parsed.data.question,
        programs,
        visas,
        history: parsed.data.history,
        knownSourceIds,
        generate: buildGoogleReportChatGenerator(),
    });

    if (!result.ok) {
        return NextResponse.json(
            { error: result.error.kind, message: result.error.message },
            { status: 502 },
        );
    }

    return NextResponse.json(result.value);
}
