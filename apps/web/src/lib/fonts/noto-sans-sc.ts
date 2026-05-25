// Shared loader for the Noto Sans SC WOFF subset shipped by
// @fontsource/noto-sans-sc. Both the PDF and the WeChat poster routes
// need the same CJK glyphs; fetching from a CDN proved unreliable
// (jsdelivr 403, Google Fonts only serves chunked subsets). Reading
// from node_modules guarantees offline reproducibility and no surprise
// network call on the request path.

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

let cached: Buffer | null = null;
let materializedPath: string | null = null;

// Candidate locations for the woff file. Turbopack rewrites
// import.meta.url to a virtual "[project]" path so createRequire from this
// module no longer resolves into the real node_modules — we walk known
// physical layouts instead. process.cwd() during `next dev` is the web
// app folder; during prod build / start it is also the app folder.
function candidatePaths(): string[] {
    const rel = path.join(
        "@fontsource",
        "noto-sans-sc",
        "files",
        "noto-sans-sc-chinese-simplified-400-normal.woff",
    );
    return [
        path.join(process.cwd(), "node_modules", rel),
        path.join(process.cwd(), "..", "..", "node_modules", rel),
    ];
}

async function locateFont(): Promise<string> {
    for (const p of candidatePaths()) {
        try {
            await fs.access(p);
            return p;
        } catch {
            // try the next candidate
        }
    }
    throw new Error(
        `Noto Sans SC font not found; looked in: ${candidatePaths().join(", ")}`,
    );
}

export async function loadNotoSansSc(): Promise<Buffer> {
    if (cached) return cached;
    cached = await fs.readFile(await locateFont());
    return cached;
}

// Returns an absolute filesystem path to the woff file in a location that
// react-pdf can read from without going through Turbopack's virtual module
// resolution. We copy the woff into the OS temp dir on first call.
export async function getNotoSansScStablePath(): Promise<string> {
    if (materializedPath) return materializedPath;
    const buf = await loadNotoSansSc();
    const target = path.join(os.tmpdir(), "isp0526-noto-sans-sc.woff");
    await fs.writeFile(target, buf);
    materializedPath = target;
    return target;
}
