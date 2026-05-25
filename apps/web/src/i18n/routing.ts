// next-intl routing configuration.
// Two supported locales; Chinese is the default and always-show prefix is on
// so the URL space is predictable (/zh/... and /en/...).

import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
    locales: ["zh", "en"],
    defaultLocale: "zh",
    localePrefix: "always",
});

export type Locale = (typeof routing.locales)[number];
