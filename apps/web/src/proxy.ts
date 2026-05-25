// next-intl middleware: rewrites / and unprefixed paths to the default
// locale, validates the locale segment, and persists the user's pick in a
// cookie for subsequent visits.

import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
    // Match all pathnames except for the ones that should never be locale-prefixed:
    // - /api routes (server actions still work fine because they POST to the
    //   current page URL which already has the locale)
    // - Next.js internals and static assets
    // - The dynamic report-export endpoints which return binary payloads and
    //   are linked from emails / WeChat scans without a locale segment.
    matcher: [
        "/((?!api|_next|_vercel|.*\\..*|r/[^/]+/pdf|r/[^/]+/poster\\.png).*)",
    ],
};
