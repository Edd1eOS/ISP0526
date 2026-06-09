const HEX_TABLE = Array.from({ length: 256 }, (_, i) =>
    i.toString(16).padStart(2, "0"),
);

declare global {
    interface Uint8Array {
        toHex?: () => string;
    }
}

export function ensureUint8ArrayHex(): void {
    if (typeof Uint8Array === "undefined") return;
    if (typeof Uint8Array.prototype.toHex === "function") return;

    Object.defineProperty(Uint8Array.prototype, "toHex", {
        configurable: true,
        enumerable: false,
        writable: true,
        value(this: Uint8Array): string {
            let out = "";
            for (let i = 0; i < this.length; i += 1) {
                out += HEX_TABLE[this[i] ?? 0];
            }
            return out;
        },
    });
}

ensureUint8ArrayHex();
