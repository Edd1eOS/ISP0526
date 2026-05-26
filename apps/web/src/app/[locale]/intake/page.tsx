import { getTranslations, setRequestLocale } from "next-intl/server";
import { RocketLauncher } from "../../../features/intake-hub/rocket-launcher";

export default async function IntakeHubPage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    setRequestLocale(locale);
    const t = await getTranslations("intakeHub");

    return (
        <main className="bg-bg relative flex min-h-screen w-full items-center justify-center overflow-hidden px-6 py-10 sm:px-12 sm:py-12">
            <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-8">
                <header className="space-y-3 text-center">
                    <span className="text-text-muted text-sm uppercase tracking-widest">
                        {t("stepTag")}
                    </span>
                    <h1 className="text-text text-4xl font-bold leading-tight sm:text-5xl">
                        {t("title")}
                    </h1>
                    <p className="text-text-muted mx-auto max-w-2xl text-base sm:text-lg">
                        {t("subtitle")}
                    </p>
                </header>

                <RocketLauncher
                    cta={t("rocket.cta")}
                    hint={t("rocket.hint")}
                    chargingHint={t("rocket.charging")}
                    launchedHint={t("rocket.launched")}
                    formLinkLabel={t("rocket.formLink")}
                    formHref="/intake/form"
                    chatHref="/intake/upload"
                />
            </div>
        </main>
    );
}
