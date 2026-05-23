// Intake session store: short-lived persistence for an in-progress intake
// where some signal (extracted text from a file, voice transcript, chat
// summary) arrived before the user has filled / confirmed every field.
// Same file-backed + in-process-cache pattern as the report store; lives
// under apps/web/.data/intake-sessions (gitignored). The session is
// disposable; once the user submits the review form, the canonical
// StudentProfile is what we persist in the report store.

import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { ExtractedProfile } from "@isp0526/core";

export type IntakeSource = "upload" | "chat";

export interface IntakeSessionSource {
    readonly kind: IntakeSource;
    readonly label: string;
    readonly text: string;
}

export interface IntakeSession {
    readonly id: string;
    readonly created_at: string;
    readonly source: IntakeSessionSource;
    readonly extracted: ExtractedProfile;
}

declare global {
    // eslint-disable-next-line no-var
    var __isp_intake_session_cache: Map<string, IntakeSession> | undefined;
}

const DATA_DIR = path.join(process.cwd(), ".data", "intake-sessions");

function cache(): Map<string, IntakeSession> {
    if (!globalThis.__isp_intake_session_cache) {
        globalThis.__isp_intake_session_cache = new Map();
    }
    return globalThis.__isp_intake_session_cache;
}

function filePath(id: string): string {
    return path.join(DATA_DIR, `${id}.json`);
}

export function newSessionId(): string {
    return randomUUID();
}

export async function saveIntakeSession(session: IntakeSession): Promise<void> {
    cache().set(session.id, session);
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(
        filePath(session.id),
        JSON.stringify(session, null, 2),
        "utf8",
    );
}

export async function loadIntakeSession(
    id: string,
): Promise<IntakeSession | undefined> {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return undefined;
    const hit = cache().get(id);
    if (hit) return hit;
    try {
        const raw = await fs.readFile(filePath(id), "utf8");
        const parsed = JSON.parse(raw) as IntakeSession;
        cache().set(id, parsed);
        return parsed;
    } catch (cause) {
        if (
            cause instanceof Error &&
            "code" in cause &&
            (cause as NodeJS.ErrnoException).code === "ENOENT"
        ) {
            return undefined;
        }
        throw cause;
    }
}
