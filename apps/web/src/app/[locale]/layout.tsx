import type { Metadata } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Inter } from "next/font/google";
import { notFound } from "next/navigation";
import "../globals.css";
import { PrivacyBanner } from "../../features/analytics/privacy-banner";
import { PostHogProvider } from "../../lib/analytics/posthog-provider";
import { Link } from "../../i18n/navigation";
import { routing } from "../../i18n/routing";

const inter = Inter({
    variable: "--font-inter",
    subsets: ["latin"],
});

export function generateStaticParams() {
    return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ locale: string }>;
}): Promise<Metadata> {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: "common" });
    return {
        title: t("appName"),
        description: t("tagline"),
    };
}

export default async function LocaleLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    if (!hasLocale(routing.locales, locale)) {
        notFound();
    }
    setRequestLocale(locale);

    const htmlLang = locale === "zh" ? "zh-CN" : "en";
    const t = await getTranslations({ locale, namespace: "common.footer" });

    return (
        <html lang={htmlLang} className={`${inter.variable} h-full antialiased`}>
            <body className="min-h-full flex flex-col">
                <NextIntlClientProvider>
                    <PostHogProvider>{children}</PostHogProvider>
                    <footer className="text-text-muted border-t bg-transparent px-6 py-6 text-xs sm:px-12">
                        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
                            <span>{t("tagline")}</span>
                            <nav className="flex flex-wrap gap-4">
                                <Link href="/legal/privacy" className="underline">
                                    {t("privacy")}
                                </Link>
                                <Link href="/legal/disclaimer" className="underline">
                                    {t("disclaimer")}
                                </Link>
                                <Link href="/legal/terms" className="underline">
                                    {t("terms")}
                                </Link>
                            </nav>
                        </div>
                    </footer>
                    <PrivacyBanner />
                </NextIntlClientProvider>
            </body>
        </html>
    );
}
