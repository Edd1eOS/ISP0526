// Root layout. The real <html>/<body> shell is rendered by the locale-scoped
// layout under app/[locale]/layout.tsx. This file only forwards children so
// route handlers and parallel routes that bypass [locale] (e.g. the public
// /r/[code]/pdf and /r/[code]/poster.png endpoints) still resolve.

import type { ReactNode } from "react";

export default function RootLayout({ children }: { children: ReactNode }) {
    return children;
}

