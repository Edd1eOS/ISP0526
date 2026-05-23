// Shim for mammoth's browser bundle which ships without TypeScript types.
// We only use extractRawText; the official .d.ts only documents the Node
// entry, so declare the minimal surface for the browser entry here.

declare module "mammoth/mammoth.browser.js" {
    export function extractRawText(input: {
        arrayBuffer: ArrayBuffer;
    }): Promise<{
        value: string;
        messages: ReadonlyArray<{ type: string; message: string }>;
    }>;
}
