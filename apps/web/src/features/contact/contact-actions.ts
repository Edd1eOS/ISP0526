"use server";

import { z } from "zod";
import { appendContactInquiry } from "../../lib/contact-store";
import { loadReport } from "../../lib/report-store";

const REPORT_CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/;

const ContactSchema = z.object({
    code: z.string().regex(REPORT_CODE_RE),
    channel: z.enum(["whatsapp", "wechat", "either"]),
    message: z.string().trim().min(1).max(1000),
    locale: z.string().min(2).max(8),
});

export interface ContactActionResult {
    readonly ok: boolean;
    readonly error?: "invalid_input" | "report_not_found" | "server_error";
}

export async function submitContactInquiryAction(
    _prev: ContactActionResult | null,
    formData: FormData,
): Promise<ContactActionResult> {
    const parsed = ContactSchema.safeParse({
        code: formData.get("code"),
        channel: formData.get("channel"),
        message: formData.get("message"),
        locale: formData.get("locale"),
    });
    if (!parsed.success) {
        return { ok: false, error: "invalid_input" };
    }
    const snapshot = await loadReport(parsed.data.code);
    if (!snapshot) {
        return { ok: false, error: "report_not_found" };
    }
    try {
        await appendContactInquiry({
            ...parsed.data,
            created_at: new Date().toISOString(),
        });
        return { ok: true };
    } catch {
        return { ok: false, error: "server_error" };
    }
}
