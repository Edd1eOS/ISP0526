import "../uint8array-hex-polyfill";

// Client-side DOCX text extractor backed by mammoth's browser build.
// mammoth.extractRawText drops styling, embedded images, headers and
// footers; for our use case (resumes, transcripts) that is exactly what
// we want to feed into the LLM. We never need the styled HTML output.

// reason: mammoth ships a browser bundle without TypeScript types at the
// `mammoth/mammoth.browser` entrypoint; dynamic import keeps the heavy
// module out of the initial chunk and side-steps the missing types issue.

type MammothBrowser = {
    extractRawText: (input: { arrayBuffer: ArrayBuffer }) => Promise<{
        value: string;
        messages: ReadonlyArray<{ type: string; message: string }>;
    }>;
};

let mammothModule: MammothBrowser | undefined;

async function loadMammoth(): Promise<MammothBrowser> {
    if (mammothModule) return mammothModule;
    // reason: mammoth's main entry pulls in node-only deps; the browser
    // bundle is the supported way to run it client-side.
    const mod = (await import("mammoth/mammoth.browser.js")) as unknown as {
        default?: MammothBrowser;
    } & MammothBrowser;
    mammothModule = mod.default ?? mod;
    return mammothModule;
}

export async function extractDocxText(file: File): Promise<string> {
    const mammoth = await loadMammoth();
    const buf = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer: buf });
    return result.value.trim();
}
