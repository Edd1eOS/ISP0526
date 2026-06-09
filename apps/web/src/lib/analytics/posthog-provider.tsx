"use client";

import "../uint8array-hex-polyfill";

// PostHog provider. Initialises posthog-js once on the client, gated by a
// consent flag stored in localStorage (see PrivacyBanner). When the consent
// flag is not "accepted" the SDK is never loaded, so no network traffic
// reaches PostHog. We also short-circuit when the public env vars are
// missing (local dev, preview builds without analytics).

import { useEffect } from "react";
import posthog from "posthog-js";

const CONSENT_STORAGE_KEY = "isp0526:analytics-consent";

function readConsent(): "accepted" | "declined" | "unknown" {
    if (typeof window === "undefined") return "unknown";
    const v = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (v === "accepted" || v === "declined") return v;
    return "unknown";
}

function publicConfig(): { host: string; key: string } | null {
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!host || !key) return null;
    return { host, key };
}

let initialized = false;

export function PostHogProvider({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        if (initialized) return;
        const config = publicConfig();
        if (!config) return;
        if (readConsent() !== "accepted") return;

        posthog.init(config.key, {
            api_host: config.host,
            capture_pageview: "history_change",
            capture_pageleave: true,
            persistence: "localStorage+cookie",
            disable_session_recording: true,
            autocapture: false,
        });
        initialized = true;
    }, []);

    return <>{children}</>;
}

export function setAnalyticsConsent(value: "accepted" | "declined"): void {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(CONSENT_STORAGE_KEY, value);
    if (value === "declined") {
        try {
            posthog.opt_out_capturing();
        } catch {
            // posthog may not be loaded yet; ignore.
        }
    } else if (value === "accepted" && !initialized) {
        const config = publicConfig();
        if (config) {
            posthog.init(config.key, {
                api_host: config.host,
                capture_pageview: "history_change",
                capture_pageleave: true,
                persistence: "localStorage+cookie",
                disable_session_recording: true,
                autocapture: false,
            });
            initialized = true;
        }
    }
}

export function readAnalyticsConsent(): "accepted" | "declined" | "unknown" {
    return readConsent();
}
