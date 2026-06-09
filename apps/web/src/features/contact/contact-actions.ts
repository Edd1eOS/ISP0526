"use server";

import { z } from "zod";
import { appendContactInquiry } from "../../lib/contact-store";
import { loadReport } from "../../lib/report-store";
import { sendContactInquiryEmail } from "../../lib/contact-email";

const REPORT_CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/;

const ContactSchema = z.object({
    code: z.string().regex(REPORT_CODE_RE).optional().or(z.literal("")),
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
    const rawCode = formData.get("code");
    const code = typeof rawCode === "string" ? rawCode.trim().toUpperCase() : "";
    const parsed = ContactSchema.safeParse({
        code: code || undefined,
        channel: formData.get("channel"),
        message: formData.get("message"),
        locale: formData.get("locale"),
    });
    if (!parsed.success) {
        return { ok: false, error: "invalid_input" };
    }
    const normalizedCode = parsed.data.code?.trim() || "";
    if (normalizedCode) {
        const snapshot = await loadReport(normalizedCode);
        if (!snapshot) {
            return { ok: false, error: "report_not_found" };
        }
    }
    try {
        const inquiry = {
            code: normalizedCode || "general",
            channel: parsed.data.channel,
            message: parsed.data.message,
            locale: parsed.data.locale,
            created_at: new Date().toISOString(),
        } as const;
        await appendContactInquiry(inquiry);
        void sendContactInquiryEmail({
            code: inquiry.code,
            channel: inquiry.channel,
            message: inquiry.message,
            locale: inquiry.locale,
            createdAt: inquiry.created_at,
        }).catch((cause) => {
            console.error("contact inquiry email failed", cause);
        });
        return { ok: true };
    } catch {
        return { ok: false, error: "server_error" };
    }
}
