// Report store: Supabase-backed with in-memory cache.
// Falls back to local filesystem (.data/reports/) when Supabase env vars are
// absent so local development works without a DB connection.

import "./uint8array-hex-polyfill";

import type {
    Candidate,
    RecommendationNarrative,
    RecommendationSet,
    ReportCode,
    StudentProfile,
} from "@isp0526/core";

export interface ReportSnapshot {
    readonly code: ReportCode;
    readonly created_at: string;
    readonly profile: StudentProfile;
    readonly set: RecommendationSet;
    readonly narratives: ReadonlyMap<string, RecommendationNarrative>;
    readonly narrative_sources: ReadonlyMap<string, "llm" | "template">;
    readonly candidates: ReadonlyMap<string, Candidate>;
}

interface PersistedSnapshot {
    readonly code: string;
    readonly created_at: string;
    readonly profile: StudentProfile;
    readonly set: RecommendationSet;
    readonly narratives: ReadonlyArray<readonly [string, RecommendationNarrative]>;
    readonly narrative_sources: ReadonlyArray<readonly [string, "llm" | "template"]>;
    readonly candidates: ReadonlyArray<readonly [string, Candidate]>;
}

declare global {
    // eslint-disable-next-line no-var
    var __isp_report_cache: Map<string, ReportSnapshot> | undefined;
}

function cache(): Map<string, ReportSnapshot> {
    if (!globalThis.__isp_report_cache) {
        globalThis.__isp_report_cache = new Map();
    }
    return globalThis.__isp_report_cache;
}

function isReportCode(code: string): boolean {
    return /^[A-HJ-NP-Z2-9]{6}$/.test(code);
}

function toSnapshot(p: PersistedSnapshot): ReportSnapshot {
    return {
        code: p.code as ReportCode,
        created_at: p.created_at,
        profile: p.profile,
        set: p.set,
        narratives: new Map(p.narratives),
        narrative_sources: new Map(p.narrative_sources ?? []),
        candidates: new Map(p.candidates),
    };
}

function toPersisted(s: ReportSnapshot): PersistedSnapshot {
    return {
        code: s.code,
        created_at: s.created_at,
        profile: s.profile,
        set: s.set,
        narratives: [...s.narratives.entries()],
        narrative_sources: [...s.narrative_sources.entries()],
        candidates: [...s.candidates.entries()],
    };
}

// ---- Supabase backend -------------------------------------------------------

function isSupabaseConfigured(): boolean {
    return Boolean(
        process.env.NEXT_PUBLIC_SUPABASE_URL &&
        process.env.SUPABASE_SERVICE_ROLE_KEY,
    );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getSupabaseAdmin(): Promise<any> {
    // Dynamic import so TypeScript doesn't need the package at compile time on
    // machines where @supabase/supabase-js isn't installed yet.
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
    const { createClient } = require("@supabase/supabase-js");
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } },
    );
}

async function saveToSupabase(snapshot: ReportSnapshot): Promise<void> {
    const sb = await getSupabaseAdmin();
    const { error } = await sb.from("reports").upsert({
        code: snapshot.code,
        created_at: snapshot.created_at,
        data: toPersisted(snapshot),
    });
    if (error) throw new Error(`Supabase saveReport: ${error.message}`);
}

async function loadFromSupabase(code: string): Promise<ReportSnapshot | undefined> {
    const sb = await getSupabaseAdmin();
    const { data, error } = await sb
        .from("reports")
        .select("data")
        .eq("code", code)
        .maybeSingle();
    if (error) throw new Error(`Supabase loadReport: ${error.message}`);
    if (!data) return undefined;
    return toSnapshot(data.data as PersistedSnapshot);
}

// ---- Filesystem fallback (local dev) ----------------------------------------

async function saveToFs(snapshot: ReportSnapshot): Promise<void> {
    const { promises: fs } = await import("node:fs");
    const path = await import("node:path");
    const DATA_DIR = path.join(process.cwd(), ".data", "reports");
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(
        path.join(DATA_DIR, `${snapshot.code}.json`),
        JSON.stringify(toPersisted(snapshot), null, 2),
        "utf8",
    );
}

async function loadFromFs(code: string): Promise<ReportSnapshot | undefined> {
    const { promises: fs } = await import("node:fs");
    const path = await import("node:path");
    const DATA_DIR = path.join(process.cwd(), ".data", "reports");
    try {
        const raw = await fs.readFile(path.join(DATA_DIR, `${code}.json`), "utf8");
        return toSnapshot(JSON.parse(raw) as PersistedSnapshot);
    } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") return undefined;
        throw err;
    }
}

// ---- Public API -------------------------------------------------------------

export async function saveReport(snapshot: ReportSnapshot): Promise<void> {
    cache().set(snapshot.code, snapshot);
    if (isSupabaseConfigured()) {
        await saveToSupabase(snapshot);
    } else {
        await saveToFs(snapshot);
    }
}

export async function loadReport(
    code: string,
): Promise<ReportSnapshot | undefined> {
    if (!isReportCode(code)) return undefined;
    const cached = cache().get(code);
    if (cached) return cached;
    const snapshot = isSupabaseConfigured()
        ? await loadFromSupabase(code)
        : await loadFromFs(code);
    if (snapshot) cache().set(code, snapshot);
    return snapshot;
}
