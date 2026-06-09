"use client";

import { useEffect } from "react";
import { Link } from "../../i18n/navigation";
import { trackEvent, trackEventOnce } from "../../lib/analytics/track";

interface ContactCardProps {
    readonly code: string;
    readonly labels: {
        readonly title: string;
        readonly body: string;
        readonly idLabel: string;
    };
}

export function ContactCard({ code, labels }: ContactCardProps) {
    useEffect(() => {
        trackEventOnce(`isp0526:rg:${code}`, "report_generated", { code });
        trackEventOnce(`isp0526:cr:${code}`, "code_revealed", {
            code,
            surface: "report_contact_card",
        });
    }, [code]);

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

            <div className="flex flex-col gap-3 pt-1">
                <Link
                    href={`/contact?code=${code}`}
                    onClick={() =>
                        trackEvent("cta_clicked", {
                            cta: "contact_form_open",
                            code,
                        })
                    }
                    className="flex items-center gap-3 px-4 py-3 text-left"
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
                        <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="white"
                            aria-hidden
                        >
                            <path
                                d="M4 4h16v12H7l-3 3V4Z"
                                stroke="white"
                                strokeWidth="2"
                                strokeLinejoin="round"
                                fill="none"
                            />
                            <path
                                d="M7 8h10M7 12h6"
                                stroke="white"
                                strokeWidth="2"
                                strokeLinecap="round"
                            />
                        </svg>
                    </span>
                    <div className="min-w-0 flex-1">
                        <p
                            className="text-text-on-primary text-xs font-semibold uppercase tracking-wider"
                            style={{ opacity: 0.8 }}
                        >
                            申请服务
                        </p>
                        <p className="text-text-on-primary text-sm font-semibold">
                            提交表单，我们按报告继续跟进
                        </p>
                    </div>
                    <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="white"
                        opacity={0.8}
                        aria-hidden
                    >
                        <path
                            d="M10 6 16 12 10 18"
                            stroke="white"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            fill="none"
                        />
                    </svg>
                </Link>
            </div>
        </section>
    );
}
