"use client";

// Minimal privacy / analytics consent banner. Shown only when the user has
// neither accepted nor declined yet. Stores decision in localStorage so it
// never reappears after a choice is made. PostHog SDK is only initialised
// once the user explicitly accepts (see posthog-provider).

import { useEffect, useState } from "react";
import {
    readAnalyticsConsent,
    setAnalyticsConsent,
} from "../../lib/analytics/posthog-provider";

export function PrivacyBanner() {
    const [show, setShow] = useState(false);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setShow(readAnalyticsConsent() === "unknown");
    }, []);

    if (!show) return null;

    const decide = (value: "accepted" | "declined") => {
        setAnalyticsConsent(value);
        setShow(false);
    };

    return (
        <div
            role="region"
            aria-label="隐私偏好"
            className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-2xl p-5"
            style={{
                background: "var(--color-surface)",
                borderRadius: "var(--radius-card-md)",
                boxShadow: "var(--shadow-clay-card)",
            }}
        >
            <div className="space-y-3">
                <p className="text-text text-sm font-semibold">
                    可以帮我们做得更好吗？
                </p>
                <p className="text-text-muted text-xs leading-relaxed">
                    我们用 PostHog 记录匿名的页面浏览和按钮点击，了解哪些环节有人卡住，
                    用来改进体验。不会记录你填写的内容，也不与任何第三方共享。
                    随时可以清空浏览器存储撤回选择。
                </p>
                <div className="flex flex-col gap-2 pt-1 sm:flex-row">
                    <button
                        type="button"
                        onClick={() => decide("accepted")}
                        className="text-text-on-primary px-4 py-2 text-sm font-semibold transition-transform active:scale-95"
                        style={{
                            background: "var(--gradient-primary)",
                            borderRadius: "var(--radius-button)",
                            boxShadow: "var(--shadow-clay-primary)",
                        }}
                    >
                        同意，匿名统计
                    </button>
                    <button
                        type="button"
                        onClick={() => decide("declined")}
                        className="text-text px-4 py-2 text-sm font-medium transition-transform active:scale-95"
                        style={{
                            background: "var(--color-surface-alt)",
                            borderRadius: "var(--radius-button)",
                        }}
                    >
                        不了，谢谢
                    </button>
                </div>
            </div>
        </div>
    );
}
