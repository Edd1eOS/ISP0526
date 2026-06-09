export interface ContactEmailPayload {
    readonly code: string;
    readonly channel: "whatsapp" | "wechat" | "either";
    readonly message: string;
    readonly locale: string;
    readonly createdAt: string;
}

function contactEmailConfigured(): boolean {
    return Boolean(
        process.env.RESEND_API_KEY &&
            process.env.CONTACT_EMAIL_FROM &&
            process.env.CONTACT_EMAIL_TO,
    );
}

function buildEmailBody(payload: ContactEmailPayload): string {
    return [
        `Report code: ${payload.code}`,
        `Locale: ${payload.locale}`,
        `Preferred channel: ${payload.channel}`,
        `Submitted at: ${payload.createdAt}`,
        "",
        "Message:",
        payload.message,
        "",
    ].join("\n");
}

export async function sendContactInquiryEmail(
    payload: ContactEmailPayload,
): Promise<void> {
    if (!contactEmailConfigured()) return;

    const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            from: process.env.CONTACT_EMAIL_FROM,
            to: [process.env.CONTACT_EMAIL_TO],
            subject: `ISP0526 enquiry: ${payload.code}`,
            text: buildEmailBody(payload),
        }),
    });

    if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(
            `Email send failed: ${response.status} ${response.statusText}${detail ? ` - ${detail}` : ""}`,
        );
    }
}
