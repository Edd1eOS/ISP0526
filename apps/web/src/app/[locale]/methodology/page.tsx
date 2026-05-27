/**
 * Methodology page. Explains the academic frameworks (Big Five / Holland),
 * the data governance pipeline, the scoring engine, and the AI boundary —
 * with citations. Linked from the landing page secondary CTA.
 */

import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "../../../i18n/navigation";

type SectionKey = "personality" | "career" | "data" | "scoring" | "ai";

const SECTION_KEYS: readonly SectionKey[] = [
    "personality",
    "career",
    "data",
    "scoring",
    "ai",
];

export default async function MethodologyPage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    setRequestLocale(locale);
    const t = await getTranslations({ locale, namespace: "methodology" });

    return (
        <main className="bg-bg min-h-screen w-full px-6 py-16 sm:px-12">
            <div className="mx-auto max-w-3xl space-y-12">
                <header className="space-y-3">
                    <span className="text-text-muted text-xs uppercase tracking-[0.3em]">
                        {t("eyebrow")}
                    </span>
                    <h1 className="text-text text-3xl font-bold leading-tight sm:text-4xl">
                        {t("title")}
                    </h1>
                    <p className="text-text-muted text-base leading-relaxed">
                        {t("intro")}
                    </p>
                </header>

                <div className="space-y-8">
                    {SECTION_KEYS.map((key) => (
                        <Section
                            key={key}
                            heading={t(`sections.${key}.heading`)}
                            body={t(`sections.${key}.body`)}
                            citations={t.raw(
                                `sections.${key}.citations`,
                            ) as readonly string[]}
                        />
                    ))}
                </div>

                <section
                    className="space-y-3 p-6"
                    style={{
                        background: "var(--color-surface-alt)",
                        borderRadius: "var(--radius-card-md)",
                        boxShadow: "var(--shadow-clay-raised)",
                    }}
                >
                    <h2 className="text-text text-xl font-semibold">
                        {t("closing.heading")}
                    </h2>
                    <p className="text-text-muted leading-relaxed">
                        {t("closing.body")}
                    </p>
                </section>

                <div className="pt-2">
                    <Link
                        href="/"
                        className="text-text inline-block px-6 py-3 text-sm font-semibold transition-transform active:scale-95"
                        style={{
                            background: "var(--gradient-raised)",
                            borderRadius: "var(--radius-button)",
                            boxShadow: "var(--shadow-clay-raised)",
                        }}
                    >
                        {t("backToHome")}
                    </Link>
                </div>
            </div>
        </main>
    );
}

interface SectionProps {
    readonly heading: string;
    readonly body: string;
    readonly citations: readonly string[];
}

function Section({ heading, body, citations }: SectionProps) {
    return (
        <section
            className="space-y-4 p-6"
            style={{
                background: "var(--color-surface)",
                borderRadius: "var(--radius-card-md)",
                boxShadow: "var(--shadow-clay-raised)",
            }}
        >
            <h2 className="text-text text-lg font-semibold leading-snug">
                {heading}
            </h2>
            <p className="text-text-muted leading-relaxed">{body}</p>
            <ol className="text-text-muted space-y-1.5 border-l-2 border-current/10 pl-4 text-xs leading-relaxed">
                {citations.map((c, i) => (
                    <li key={i}>{c}</li>
                ))}
            </ol>
        </section>
    );
}
