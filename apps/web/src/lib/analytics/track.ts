"use client";

import "../uint8array-hex-polyfill";
import posthog from "posthog-js";

// Single safe entry-point for PostHog `capture` calls from client components.
// PostHog is consent-gated and may not be initialised; this wrapper no-ops
// in that case so call sites don't need their own try/catch boilerplate.
export function trackEvent(event: string, props?: Record<string, unknown>): void {
    if (typeof window === "undefined") return;
    try {
        posthog.capture?.(event, props);
    } catch {
        // posthog not initialised (consent declined) or transport unavailable.
    }
}

// Fire `event` at most once per browser session for a given dedupe key.
// Used for "first view of a generated report" semantics where a user may
// refresh the page multiple times in the same session.
export function trackEventOnce(
    storageKey: string,
    event: string,
    props?: Record<string, unknown>,
): void {
    if (typeof window === "undefined") return;
    try {
        if (window.sessionStorage.getItem(storageKey) === "1") return;
        posthog.capture?.(event, props);
        window.sessionStorage.setItem(storageKey, "1");
    } catch {
        // sessionStorage unavailable in some embed contexts; ignore.
    }
}
