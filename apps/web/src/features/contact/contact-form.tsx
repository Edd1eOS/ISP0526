"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import posthog from "posthog-js";
import {
    submitContactInquiryAction,
    type ContactActionResult,
} from "./contact-actions";

interface ContactFormProps {
    readonly code: string;
    readonly locale: string;
    readonly labels: {
        readonly channelLabel: string;
        readonly channelWhatsapp: string;
        readonly channelWeChat: string;
        readonly channelEither: string;
        readonly messageLabel: string;
        readonly messagePlaceholder: string;
        readonly submit: string;
        readonly submitting: string;
        readonly successTitle: string;
        readonly successBody: string;
        readonly errorInvalid: string;
        readonly errorNotFound: string;
        readonly errorServer: string;
    };
}

const INITIAL: ContactActionResult | null = null;

export function ContactForm({ code, locale, labels }: ContactFormProps) {
    const [state, action] = useActionState(submitContactInquiryAction, INITIAL);
    const [channel, setChannel] = useState<"whatsapp" | "wechat" | "either">(
        "either",
    );

    useEffect(() => {
        if (state?.ok) {
            try {
                posthog.capture?.("contact_inquiry_submitted", { code, channel });
            } catch {
                // posthog may not be initialised (consent declined); fine.
            }
        }
    }, [state, code, channel]);

    if (state?.ok) {
        return (
            <div
                className="space-y-2 p-6"
                style={{
                    background: "var(--color-surface-alt)",
                    borderRadius: "var(--radius-card-md)",
                    boxShadow: "var(--shadow-clay-raised)",
                }}
            >
                <p className="text-text text-base font-semibold">
                    {labels.successTitle}
                </p>
                <p className="text-text-muted text-sm">{labels.successBody}</p>
            </div>
        );
    }

    const errorMessage =
        state?.error === "invalid_input"
            ? labels.errorInvalid
            : state?.error === "report_not_found"
              ? labels.errorNotFound
              : state?.error === "server_error"
                ? labels.errorServer
                : null;

    return (
        <form action={action} className="space-y-4">
            <input type="hidden" name="code" value={code} />
            <input type="hidden" name="locale" value={locale} />

            <fieldset className="space-y-2">
                <legend className="text-text text-sm font-medium">
                    {labels.channelLabel}
                </legend>
                <div className="flex flex-wrap gap-2">
                    {(
                        [
                            ["whatsapp", labels.channelWhatsapp],
                            ["wechat", labels.channelWeChat],
                            ["either", labels.channelEither],
                        ] as const
                    ).map(([value, label]) => {
                        const selected = channel === value;
                        return (
                            <label
                                key={value}
                                className="text-text cursor-pointer px-4 py-2 text-sm font-medium"
                                style={{
                                    background: selected
                                        ? "var(--gradient-primary)"
                                        : "var(--gradient-raised)",
                                    color: selected
                                        ? "var(--color-text-on-primary)"
                                        : undefined,
                                    borderRadius: "var(--radius-button)",
                                    boxShadow: selected
                                        ? "var(--shadow-clay-primary)"
                                        : "var(--shadow-clay-raised)",
                                }}
                            >
                                <input
                                    type="radio"
                                    name="channel"
                                    value={value}
                                    checked={selected}
                                    onChange={() => setChannel(value)}
                                    className="sr-only"
                                />
                                {label}
                            </label>
                        );
                    })}
                </div>
            </fieldset>

            <label className="block space-y-2">
                <span className="text-text text-sm font-medium">
                    {labels.messageLabel}
                </span>
                <textarea
                    name="message"
                    required
                    minLength={1}
                    maxLength={1000}
                    rows={4}
                    placeholder={labels.messagePlaceholder}
                    className="text-text w-full resize-none p-3 text-sm outline-none"
                    style={{
                        background: "var(--color-surface)",
                        borderRadius: "var(--radius-input)",
                        boxShadow: "var(--shadow-clay-inset)",
                    }}
                />
            </label>

            {errorMessage ? (
                <p className="text-sm" style={{ color: "var(--color-warning)" }}>
                    {errorMessage}
                </p>
            ) : null}

            <SubmitButton submit={labels.submit} submitting={labels.submitting} />
        </form>
    );
}

function SubmitButton({
    submit,
    submitting,
}: {
    submit: string;
    submitting: string;
}) {
    const { pending } = useFormStatus();
    return (
        <button
            type="submit"
            disabled={pending}
            className="text-text-on-primary px-5 py-2.5 text-sm font-semibold transition-transform active:scale-95 disabled:opacity-60"
            style={{
                background: "var(--gradient-primary)",
                borderRadius: "var(--radius-button)",
                boxShadow: "var(--shadow-clay-primary)",
            }}
        >
            {pending ? submitting : submit}
        </button>
    );
}
