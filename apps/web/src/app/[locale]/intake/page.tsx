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
        <main className="bg-bg relative min-h-screen w-full overflow-hidden px-6 py-10 sm:px-12 sm:py-12">
            <div className="mx-auto flex max-w-3xl flex-col items-center gap-6">
                <header className="space-y-2 text-center">
                    <span className="text-text-muted text-sm uppercase tracking-widest">
                        {t("stepTag")}
                    </span>
                    <h1 className="text-text text-3xl font-bold leading-tight sm:text-4xl">
                        {t("title")}
                    </h1>
                    <p className="text-text-muted mx-auto max-w-xl">
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
