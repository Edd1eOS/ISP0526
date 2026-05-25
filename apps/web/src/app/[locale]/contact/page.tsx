import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ContactForm } from "../../../features/contact/contact-form";
import { Link } from "../../../i18n/navigation";
import { loadReport } from "../../../lib/report-store";

interface ContactPageProps {
    readonly params: Promise<{ locale: string }>;
    readonly searchParams: Promise<{ code?: string }>;
}

const REPORT_CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/;

export default async function ContactPage({
    params,
    searchParams,
}: ContactPageProps) {
    const { locale } = await params;
    setRequestLocale(locale);
    const { code } = await searchParams;
    const t = await getTranslations({ locale, namespace: "contactPage" });

    if (!code || !REPORT_CODE_RE.test(code)) {
        return <MissingCode locale={locale} />;
    }
    const snapshot = await loadReport(code);
    if (!snapshot) notFound();

    return (
        <main className="bg-bg min-h-screen w-full px-6 py-16 sm:px-12">
            <div className="mx-auto max-w-2xl space-y-8">
                <header className="space-y-2">
                    <span className="text-text-muted text-sm uppercase tracking-widest">
                        {t("eyebrow")}
                    </span>
                    <h1 className="text-text text-3xl font-bold leading-tight">
                        {t("title")}
                    </h1>
                    <p className="text-text-muted">{t("intro")}</p>
                </header>

                <section
                    className="space-y-3 p-6"
                    style={{
                        background: "var(--color-surface-alt)",
                        borderRadius: "var(--radius-card-md)",
                        boxShadow: "var(--shadow-clay-raised)",
                    }}
                >
                    <p className="text-text-muted text-xs uppercase tracking-widest">
                        {t("reportIdLabel")}
                    </p>
                    <div
                        className="text-text inline-block px-4 py-2 font-mono text-base font-semibold"
                        style={{
                            background: "var(--color-surface)",
                            borderRadius: "var(--radius-button)",
                            boxShadow: "var(--shadow-clay-inset)",
                        }}
                    >
                        {snapshot.code}
                    </div>
                    <p className="text-text-muted text-sm">{t("reportIdHint")}</p>
                </section>

                <ContactForm
                    code={snapshot.code}
                    locale={locale}
                    labels={{
                        channelLabel: t("channelLabel"),
                        channelWhatsapp: t("channelWhatsapp"),
                        channelWeChat: t("channelWeChat"),
                        channelEither: t("channelEither"),
                        messageLabel: t("messageLabel"),
                        messagePlaceholder: t("messagePlaceholder"),
                        submit: t("submit"),
                        submitting: t("submitting"),
                        successTitle: t("successTitle"),
                        successBody: t("successBody"),
                        errorInvalid: t("errorInvalid"),
                        errorNotFound: t("errorNotFound"),
                        errorServer: t("errorServer"),
                    }}
                />

                <p className="text-text-muted text-xs">{t("disclaimer")}</p>

                <Link
                    href={`/r/${snapshot.code}`}
                    className="text-text inline-block text-sm underline"
                >
                    {t("backToReport")}
                </Link>
            </div>
        </main>
    );
}

function MissingCode({ locale }: { locale: string }) {
    return (
        <main className="bg-bg min-h-screen w-full px-6 py-16 sm:px-12">
            <div className="mx-auto max-w-2xl space-y-4">
                <h1 className="text-text text-2xl font-semibold">
                    {locale === "zh" ? "缺少报告 ID" : "Missing report ID"}
                </h1>
                <p className="text-text-muted">
                    {locale === "zh"
                        ? "请从你的报告页底部「想找人聊聊？」卡片进入。"
                        : "Please enter from the contact card at the bottom of your report."}
                </p>
                <Link href="/" className="text-text inline-block text-sm underline">
                    {locale === "zh" ? "回到首页" : "Back to home"}
                </Link>
            </div>
        </main>
    );
}
