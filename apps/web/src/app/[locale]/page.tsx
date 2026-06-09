/**
 * Landing page. Clay-style hero with a rotating globe, an orbiter, and
 * landmarks that pop up region-by-region. The copy is i18n-driven; the
 * placeholder title is the project codename until branding is approved.
 */

import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "../../i18n/navigation";
import { HeroGlobe } from "../../features/landing/hero-globe";

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
  const switcherLabel = locale === "zh"
    ? tSwitcher("switchToEn")
    : tSwitcher("switchToZh");

  return (
    <main className="bg-bg relative min-h-screen w-full overflow-hidden">
      {/* Top bar: brand tag + language switcher */}
      <div className="relative z-10 flex items-center justify-between px-6 pt-6 sm:px-12">
        <span className="text-text-muted text-xs uppercase tracking-[0.3em]">
          {t("sprintTag")}
        </span>
        <a
          href={`/${otherLocale}`}
          className="text-text px-4 py-2 text-xs font-semibold uppercase tracking-widest transition-transform active:scale-95"
          style={{
            background: "var(--gradient-raised)",
            borderRadius: "var(--radius-button)",
            boxShadow: "var(--shadow-clay-raised)",
          }}
        >
          {switcherLabel}
        </a>
      </div>

      {/* Title block */}
      <section className="relative z-10 mx-auto mt-10 max-w-4xl px-6 text-center sm:mt-14 sm:px-12">
        <h1
          className="text-text font-black tracking-tight"
          style={{
            fontSize: "clamp(64px, 13vw, 168px)",
            lineHeight: 0.95,
            textShadow:
              "0 6px 0 rgba(122,66,32,0.18), 0 18px 32px rgba(217,119,87,0.28)",
          }}
        >
          {t("heroTitle")}
        </h1>
        <p className="text-text-muted mx-auto mt-5 max-w-xl text-base leading-relaxed sm:text-lg">
          {t("heroSubtitle")}
        </p>
      </section>

      {/* Animated globe scene */}
      <section className="relative z-0 mx-auto mt-2 w-full max-w-5xl px-4 sm:mt-4">
        <HeroGlobe />
      </section>

      {/* CTA row */}
      <section className="relative z-10 mx-auto -mt-8 flex max-w-2xl flex-col items-center justify-center gap-4 px-6 pb-16 sm:flex-row sm:gap-5">
        <Link
          href="/intake"
          className="text-text-on-primary px-7 py-3.5 text-base font-semibold transition-transform active:scale-95"
          style={{
            background: "var(--gradient-primary)",
            borderRadius: "var(--radius-button)",
            boxShadow: "var(--shadow-clay-primary)",
          }}
        >
          {t("ctaStart")}
        </Link>
        <Link
          href="/methodology"
          className="text-text px-7 py-3.5 text-base font-semibold transition-transform active:scale-95"
          style={{
            background: "var(--gradient-raised)",
            borderRadius: "var(--radius-button)",
            boxShadow: "var(--shadow-clay-raised)",
          }}
        >
          {t("ctaSecondary")}
        </Link>
        <Link
          href="/contact"
          className="text-text px-7 py-3.5 text-base font-semibold transition-transform active:scale-95"
          style={{
            background: "var(--gradient-raised)",
            borderRadius: "var(--radius-button)",
            boxShadow: "var(--shadow-clay-raised)",
          }}
        >
          {locale === "zh" ? "提交申请服务" : "Submit enquiry"}
        </Link>
      </section>

      {/* Footer tag */}
      <footer className="text-text-muted relative z-10 pb-6 text-center text-[11px] uppercase tracking-[0.25em]">
        {tCommon("appName")}
      </footer>
    </main>
  );
}
