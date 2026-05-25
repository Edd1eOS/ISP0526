import type { Metadata } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Inter } from "next/font/google";
import { notFound } from "next/navigation";
import "../globals.css";
import { PrivacyBanner } from "../../features/analytics/privacy-banner";
import { PostHogProvider } from "../../lib/analytics/posthog-provider";
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

    return (
        <html lang={htmlLang} className={`${inter.variable} h-full antialiased`}>
            <body className="min-h-full flex flex-col">
                <NextIntlClientProvider>
                    <PostHogProvider>{children}</PostHogProvider>
                    <PrivacyBanner />
                </NextIntlClientProvider>
            </body>
        </html>
    );
}
