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

    const rawCode = (code ?? "").trim().toUpperCase();
    const hasCode = REPORT_CODE_RE.test(rawCode);
    const snapshot = hasCode ? await loadReport(rawCode) : null;
    if (rawCode && hasCode && !snapshot) notFound();

    const isZh = locale === "zh";
    const title = snapshot
        ? isZh
            ? "基于报告提交申请"
            : "Submit an enquiry for this report"
        : isZh
            ? "提交申请服务"
            : "Submit an application enquiry";
    const intro = snapshot
        ? isZh
            ? "把你的报告号带进来，我们会按你的结果继续跟进，做申请服务。"
            : "Your report code is attached so we can follow up on the exact result set."
        : isZh
            ? "不需要微信或 WhatsApp 直链，直接填表就行。我们收到后会跟进申请服务。"
            : "No direct chat link is needed. Fill in the form and we will follow up on the application service.";

    return (
        <main className="bg-bg min-h-screen w-full px-6 py-16 sm:px-12">
            <div className="mx-auto max-w-2xl space-y-8">
                <header className="space-y-2">
                    <span className="text-text-muted text-sm uppercase tracking-widest">
                        {snapshot ? "Report follow-up" : "Enquiry form"}
                    </span>
                    <h1 className="text-text text-3xl font-bold leading-tight">
                        {title}
                    </h1>
                    <p className="text-text-muted">{intro}</p>
                </header>

                {rawCode && !hasCode ? (
                    <p className="text-sm" style={{ color: "var(--color-warning)" }}>
                        {isZh
                            ? "报告号格式不正确，但你仍然可以直接提交通用申请。"
                            : "The report code format is invalid, but you can still submit a general enquiry."}
                    </p>
                ) : null}

                {snapshot ? (
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
                ) : null}

                <ContactForm
                    code={snapshot?.code ?? (rawCode || undefined)}
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
                    href={snapshot ? `/r/${snapshot.code}` : "/"}
                    className="text-text inline-block text-sm underline"
                >
                    {snapshot
                        ? t("backToReport")
                        : isZh
                            ? "回到首页"
                            : "Back to home"}
                </Link>
            </div>
        </main>
    );
}
