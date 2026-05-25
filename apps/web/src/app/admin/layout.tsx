// Locale-free root layout for the internal /admin surface. The user-facing
// app's root layout lives under `[locale]/layout.tsx`, so this segment needs
// its own html/body wrapper. English-only on purpose; staff tool.

import type { ReactNode } from "react";
import "../globals.css";

export const metadata = {
    title: "Admin · ISP0526",
    robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="en">
            <body className="bg-stone-50 text-stone-900 antialiased">
                {children}
            </body>
        </html>
    );
}
