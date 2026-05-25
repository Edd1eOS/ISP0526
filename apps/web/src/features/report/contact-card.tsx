"use client";

import { useEffect } from "react";
import { trackEvent, trackEventOnce } from "../../lib/analytics/track";
import { Link } from "../../i18n/navigation";

interface ContactCardProps {
    readonly code: string;
    readonly labels: {
        readonly title: string;
        readonly body: string;
        readonly cta: string;
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

    const fireCtaClicked = () => {
        trackEvent("cta_clicked", { cta: "talk_to_us", code });
    };

    return (
        <section
            className="space-y-3 p-6"
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
            <Link
                href={`/contact?code=${code}`}
                onClick={fireCtaClicked}
                className="text-text-on-primary inline-block px-5 py-2.5 text-sm font-semibold"
                style={{
                    background: "var(--gradient-primary)",
                    borderRadius: "var(--radius-button)",
                    boxShadow: "var(--shadow-clay-primary)",
                }}
            >
                {labels.cta}
            </Link>
        </section>
    );
}
