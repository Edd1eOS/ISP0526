/**
 * Landing / token-preview page. Still doubles as the design-system smoke
 * test, but now reads its copy from next-intl messages.
 */

import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "../../i18n/navigation";

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("landing");
  const tCommon = await getTranslations("common");
  const tSwitcher = await getTranslations("common.localeSwitcher");
  const otherLocale = locale === "zh" ? "en" : "zh";

  return (
    <main className="bg-bg min-h-screen w-full px-6 py-16 sm:px-12">
      <div className="mx-auto max-w-3xl space-y-12">
        <header className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <span className="text-text-muted text-sm uppercase tracking-widest">
              {t("sprintTag")}
            </span>
            <a
              href={`/${otherLocale}`}
              className="text-text-muted hover:text-text text-xs uppercase tracking-widest"
            >
              {tSwitcher("label")}:{" "}
              {tSwitcher(otherLocale as "zh" | "en")}
            </a>
          </div>
          <h1 className="text-text text-4xl font-bold leading-tight sm:text-5xl">
            {tCommon("appName")}
          </h1>
          <p className="text-text-muted max-w-xl text-lg leading-relaxed">
            {t("heroSubtitle")}
          </p>
        </header>

        {/* Card surface */}
        <section
          className="bg-surface space-y-4 p-8"
          style={{
            borderRadius: "var(--radius-card-lg)",
            boxShadow: "var(--shadow-clay-card)",
          }}
        >
          <h2 className="text-text text-2xl font-semibold">
            {t("cardTitle")}
          </h2>
          <p className="text-text-muted">{t("cardBody")}</p>

          {/* Buttons row */}
          <div className="flex flex-col gap-4 pt-4 sm:flex-row">
            <Link
              href="/intake"
              className="text-text-on-primary px-6 py-3 text-base font-semibold transition-transform active:scale-95"
              style={{
                background: "var(--gradient-primary)",
                borderRadius: "var(--radius-button)",
                boxShadow: "var(--shadow-clay-primary)",
              }}
            >
              {tCommon("cta.start")}
            </Link>

            <a
              href="#"
              className="text-text px-6 py-3 text-base font-semibold transition-transform active:scale-95"
              style={{
                background: "var(--gradient-raised)",
                borderRadius: "var(--radius-button)",
                boxShadow: "var(--shadow-clay-raised)",
              }}
            >
              {tCommon("cta.learnMore")}
            </a>
          </div>
        </section>

        {/* Palette swatches */}
        <section className="space-y-4">
          <h2 className="text-text text-xl font-semibold">
            {t("paletteTitle")}
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            {SWATCHES.map((s) => (
              <div
                key={s.token}
                className="flex flex-col items-center gap-2 p-3 text-center"
                style={{
                  background: "var(--color-surface)",
                  borderRadius: "var(--radius-card-md)",
                  boxShadow: "var(--shadow-clay-raised)",
                }}
              >
                <span
                  className="h-12 w-12"
                  style={{
                    background: `var(${s.token})`,
                    borderRadius: "var(--radius-icon)",
                  }}
                  aria-hidden
                />
                <span className="text-text text-xs font-medium">
                  {s.name}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

const SWATCHES: ReadonlyArray<{ token: string; name: string }> = [
  { token: "--color-bg", name: "bg" },
  { token: "--color-surface", name: "surface" },
  { token: "--color-primary-from", name: "primary" },
  { token: "--color-accent", name: "accent" },
  { token: "--color-warning", name: "warning" },
];
