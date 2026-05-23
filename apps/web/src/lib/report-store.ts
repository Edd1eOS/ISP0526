// Phase 1 report store: JSON files on disk under apps/web/.data/reports,
// with a per-process in-memory cache so the report page does not re-read
// the file on every render. Single-machine, single-process; we will move
// to Supabase when we need multi-instance or auth.

import { promises as fs } from "node:fs";
import path from "node:path";
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
    readonly candidates: ReadonlyMap<string, Candidate>;
}

interface PersistedSnapshot {
    readonly code: string;
    readonly created_at: string;
    readonly profile: StudentProfile;
    readonly set: RecommendationSet;
    readonly narratives: ReadonlyArray<readonly [string, RecommendationNarrative]>;
    readonly candidates: ReadonlyArray<readonly [string, Candidate]>;
}

declare global {
    // eslint-disable-next-line no-var
    var __isp_report_cache: Map<string, ReportSnapshot> | undefined;
}

const DATA_DIR = path.join(process.cwd(), ".data", "reports");

function cache(): Map<string, ReportSnapshot> {
    if (!globalThis.__isp_report_cache) {
        globalThis.__isp_report_cache = new Map();
    }
    return globalThis.__isp_report_cache;
}

function isReportCode(code: string): boolean {
    return /^[A-HJ-NP-Z2-9]{6}$/.test(code);
}

function filePath(code: string): string {
    return path.join(DATA_DIR, `${code}.json`);
}

export async function saveReport(snapshot: ReportSnapshot): Promise<void> {
    cache().set(snapshot.code, snapshot);
    await fs.mkdir(DATA_DIR, { recursive: true });
    const persisted: PersistedSnapshot = {
        code: snapshot.code,
        created_at: snapshot.created_at,
        profile: snapshot.profile,
        set: snapshot.set,
        narratives: [...snapshot.narratives.entries()],
        candidates: [...snapshot.candidates.entries()],
    };
    await fs.writeFile(
        filePath(snapshot.code),
        JSON.stringify(persisted, null, 2),
        "utf8",
    );
}

export async function loadReport(
    code: string,
): Promise<ReportSnapshot | undefined> {
    if (!isReportCode(code)) return undefined;
    const cached = cache().get(code);
    if (cached) return cached;
    let raw: string;
    try {
        raw = await fs.readFile(filePath(code), "utf8");
    } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") return undefined;
        throw err;
    }
    const persisted = JSON.parse(raw) as PersistedSnapshot;
    const snapshot: ReportSnapshot = {
        code: persisted.code as ReportCode,
        created_at: persisted.created_at,
        profile: persisted.profile,
        set: persisted.set,
        narratives: new Map(persisted.narratives),
        candidates: new Map(persisted.candidates),
    };
    cache().set(code, snapshot);
    return snapshot;
}
