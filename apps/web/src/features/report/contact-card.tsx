"use client";

import { useState, useEffect } from "react";
import { trackEvent, trackEventOnce } from "../../lib/analytics/track";

// ---------------------------------------------------------------------------
// Replace these two constants with real contact details before going live.
// ---------------------------------------------------------------------------
const TEAM_WECHAT_ID = "ISP_WeChat_ID";           // TODO: 填入微信号
const TEAM_WHATSAPP_URL = "https://wa.me/61400000000"; // TODO: 填入真实号码

interface ContactCardProps {
    readonly code: string;
    readonly labels: {
        readonly title: string;
        readonly body: string;
        readonly idLabel: string;
    };
}

export function ContactCard({ code, labels }: ContactCardProps) {
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        trackEventOnce(`isp0526:rg:${code}`, "report_generated", { code });
        trackEventOnce(`isp0526:cr:${code}`, "code_revealed", {
            code,
            surface: "report_contact_card",
        });
    }, [code]);

    const copyWechat = () => {
        void navigator.clipboard.writeText(TEAM_WECHAT_ID).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
        trackEvent("cta_clicked", { cta: "wechat_copy", code });
    };

    const fireWhatsapp = () => {
        trackEvent("cta_clicked", { cta: "whatsapp_open", code });
    };

    return (
        <section
            className="space-y-4 p-6"
            style={{
                background: "var(--color-surface-alt)",
                borderRadius: "var(--radius-card-md)",
                boxShadow: "var(--shadow-clay-raised)",
            }}
        >
            <h2 className="text-text text-lg font-semibold">{labels.title}</h2>
            <p className="text-text-muted text-sm">{labels.body}</p>

            <div className="space-y-1">
                <p className="text-text-muted text-xs uppercase tracking-widest">
                    {labels.idLabel}
                </p>
                <div
                    className="text-text inline-block px-4 py-2 font-mono text-base font-semibold"
                    style={{
                        background: "var(--color-surface)",
                        borderRadius: "var(--radius-button)",
                        boxShadow: "var(--shadow-clay-inset)",
                    }}
                >
                    {code}
                </div>
            </div>

            {/* Contact channels */}
            <div className="flex flex-col gap-3 pt-1">
                {/* WeChat */}
                <button
                    type="button"
                    onClick={copyWechat}
                    className="flex items-center gap-3 px-4 py-3 text-left"
                    style={{
                        background: "var(--color-surface)",
                        borderRadius: "var(--radius-button)",
                        boxShadow: "var(--shadow-clay-raised)",
                        border: "none",
                        cursor: "pointer",
                    }}
                >
                    <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                        style={{ background: "#07C160" }}
                        aria-hidden
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="white" aria-hidden>
                            <path d="M8.69 2.19C3.89 2.19 0 5.48 0 9.53c0 2.21 1.17 4.2 3 5.55a.59.59 0 0 1 .21.67l-.39 1.48c-.02.07-.05.14-.05.21 0 .16.13.3.3.3a.33.33 0 0 0 .17-.05l1.9-1.11a.86.86 0 0 1 .72-.1c.91.26 1.87.4 2.83.4.42 0 .84-.04 1.26-.09a4.5 4.5 0 0 1-.04-.63c0-3.76 3.67-6.8 8.2-6.8.32 0 .64.02.96.06C17.54 4.52 13.44 2.19 8.69 2.19zm-1.52 4c.56 0 1.01.45 1.01 1.01s-.45 1.01-1.01 1.01A1.01 1.01 0 0 1 6.16 7.2c0-.56.45-1.01 1.01-1.01zm5.02 0c.56 0 1.01.45 1.01 1.01s-.45 1.01-1.01 1.01A1.01 1.01 0 0 1 11.18 7.2c0-.56.45-1.01 1.01-1.01zm4.5 3.6c-4.05 0-7.35 2.85-7.35 6.38s3.3 6.38 7.35 6.38c.94 0 1.84-.16 2.67-.46a.66.66 0 0 1 .55.08l1.43.84a.25.25 0 0 0 .13.04.22.22 0 0 0 .22-.23c0-.05-.02-.11-.04-.16l-.3-1.12a.45.45 0 0 1 .16-.51c1.39-1.01 2.27-2.54 2.27-4.24 0-3.53-3.29-6.38-7.34-6.38h-.06zm-2.55 3.02c.42 0 .77.34.77.77s-.35.77-.77.77a.77.77 0 0 1-.77-.77c0-.43.34-.77.77-.77zm5.1 0c.42 0 .77.34.77.77s-.35.77-.77.77a.77.77 0 0 1-.77-.77c0-.43.34-.77.77-.77z" />
                        </svg>
                    </span>
                    <div className="min-w-0 flex-1">
                        <p className="text-text text-xs font-semibold uppercase tracking-wider" style={{ opacity: 0.55 }}>微信</p>
                        <p className="text-text font-mono text-sm font-semibold">{TEAM_WECHAT_ID}</p>
                    </div>
                    <span
                        className="shrink-0 px-3 py-1 text-xs font-medium"
                        style={{
                            background: "var(--color-surface-alt)",
                            borderRadius: "var(--radius-button)",
                            color: copied ? "#07C160" : "var(--color-text-muted)",
                            transition: "color 0.2s",
                        }}
                    >
                        {copied ? "已复制" : "复制"}
                    </span>
                </button>

                {/* WhatsApp */}
                <a
                    href={TEAM_WHATSAPP_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={fireWhatsapp}
                    className="flex items-center gap-3 px-4 py-3"
                    style={{
                        background: "var(--gradient-primary)",
                        borderRadius: "var(--radius-button)",
                        boxShadow: "var(--shadow-clay-primary)",
                        textDecoration: "none",
                    }}
                >
                    <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                        style={{ background: "rgba(255,255,255,0.22)" }}
                        aria-hidden
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="white" aria-hidden>
                            <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.26-.46-2.39-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51-.17-.01-.37-.01-.57-.01-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35m-5.42 7.4h-.004a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37A9.86 9.86 0 0 1 2.16 11.9C2.16 6.45 6.6 2.01 12.05 2.01c2.64 0 5.12 1.03 6.99 2.9a9.83 9.83 0 0 1 2.89 6.99c-.003 5.45-4.44 9.88-9.88 9.88m8.41-18.3A11.82 11.82 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.68 1.45h.005c6.55 0 11.89-5.34 11.89-11.89a11.82 11.82 0 0 0-3.48-8.41z" />
                        </svg>
                    </span>
                    <span className="text-text-on-primary flex-1 text-sm font-semibold">
                        WhatsApp 联系
                    </span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="white" opacity={0.7} aria-hidden>
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    </svg>
                </a>
            </div>
        </section>
    );
}
