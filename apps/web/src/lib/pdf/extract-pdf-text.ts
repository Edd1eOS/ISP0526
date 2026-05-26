// Client-side PDF text extractor. Uses pdfjs-dist with the worker loaded
// from the same package via a relative URL - works under Next.js Turbopack
// without a dedicated worker pipeline because pdfjs ships an ESM worker.
//
// The function returns the concatenated text of every page, separated by a
// double newline so downstream heuristics can spot page boundaries.

// Client-side PDF text extractor.
//
// We run pdfjs in the main thread (no Web Worker) to avoid bundler-specific
// worker plumbing under Next.js Turbopack. For the document sizes we expect
// here (resumes, transcripts, offer letters; usually < 10 pages) the perf
// difference is negligible and the user already sees per-page progress.

let pdfjsModule: typeof import("pdfjs-dist") | undefined;

async function loadPdfjs(): Promise<typeof import("pdfjs-dist")> {
    if (pdfjsModule) return pdfjsModule;
    const mod = await import("pdfjs-dist");
    // reason: Turbopack/Next can resolve the ESM worker via new URL(...,
    // import.meta.url). Pointing GlobalWorkerOptions.workerSrc at it lets
    // pdfjs spawn its real worker rather than failing the assertion that
    // workerSrc be non-empty.
    const workerUrl = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
    );
    mod.GlobalWorkerOptions.workerSrc = workerUrl.toString();
    pdfjsModule = mod;
    return mod;
}

export async function extractPdfText(
    file: File,
    onProgress?: (percent: number) => void,
): Promise<string> {
    const pdfjs = await loadPdfjs();
    const buf = await file.arrayBuffer();
    const doc = await pdfjs.getDocument({ data: buf }).promise;

    const pages: string[] = [];
    for (let i = 1; i <= doc.numPages; i += 1) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        const line = content.items
            // reason: pdfjs returns TextItem | TextMarkedContent; only
            // TextItem carries the `str` field we want.
            .map((it) => ("str" in it ? it.str : ""))
            .filter(Boolean)
            .join(" ");
        pages.push(line);
        if (onProgress) onProgress(Math.round((i / doc.numPages) * 100));
    }
    return pages.join("\n\n");
}
