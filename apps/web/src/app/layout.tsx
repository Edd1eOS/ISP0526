import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { PostHogProvider } from "../lib/analytics/posthog-provider";
import { PrivacyBanner } from "../features/analytics/privacy-banner";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ISP0526 — one-stop study-abroad launcher",
  description:
    "AI-assisted Australian university recommendation, grounded in verifiable data.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <PostHogProvider>{children}</PostHogProvider>
        <PrivacyBanner />
      </body>
    </html>
  );
}
