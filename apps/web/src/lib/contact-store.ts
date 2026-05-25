// Phase 1 contact-inquiry store: append-only JSON-line files under
// apps/web/.data/contacts/{code}.jsonl. Each line is one inquiry submitted
// from the report-page contact flow. Single-process, file-backed; the same
// trade-offs as report-store apply (will move to Supabase when auth lands).

import { promises as fs } from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), ".data", "contacts");

export type ContactChannel = "whatsapp" | "wechat" | "either";

export interface ContactInquiry {
    readonly code: string;
    readonly channel: ContactChannel;
    readonly message: string;
    readonly locale: string;
    readonly created_at: string;
}

function filePath(code: string): string {
    return path.join(DATA_DIR, `${code}.jsonl`);
}

export async function appendContactInquiry(
    inquiry: ContactInquiry,
): Promise<void> {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.appendFile(
        filePath(inquiry.code),
        `${JSON.stringify(inquiry)}\n`,
        "utf8",
    );
}

export async function listContactInquiries(
    code: string,
): Promise<ReadonlyArray<ContactInquiry>> {
    let raw: string;
    try {
        raw = await fs.readFile(filePath(code), "utf8");
    } catch (cause) {
        if ((cause as NodeJS.ErrnoException).code === "ENOENT") return [];
        throw cause;
    }
    const out: ContactInquiry[] = [];
    for (const line of raw.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
            out.push(JSON.parse(trimmed) as ContactInquiry);
        } catch {
            // Skip malformed lines; do not crash the admin view.
        }
    }
    return out;
}
