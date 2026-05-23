// Report code: 6-character Crockford-style identifier that the user can read
// off a printed page or paste into a chat. The character set excludes I, L,
// O, 0, and 1 to avoid confusion. Matches `ReportCodeSchema`.

import { ReportCodeSchema, type ReportCode } from "../schemas/ids";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;

export function generateReportCode(
    rng: () => number = Math.random,
): ReportCode {
    let out = "";
    for (let i = 0; i < CODE_LENGTH; i += 1) {
        const idx = Math.floor(rng() * ALPHABET.length);
        out += ALPHABET[idx];
    }
    return ReportCodeSchema.parse(out);
}
