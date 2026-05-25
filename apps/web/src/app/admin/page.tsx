// Internal staff lookup. Locale-free on purpose: this surface is not part of
// the user-facing product, lives outside the `[locale]` segment, and the
// strings stay in English so it does not need i18n message keys.
//
// Access control: a single shared token compared against the `ADMIN_TOKEN`
// env var. If the env var is unset, the route is disabled entirely
// (returns 404) so a forgotten secret cannot leak the dashboard.

import { notFound } from "next/navigation";
import Link from "next/link";
import { loadReport } from "../../lib/report-store";
import { listContactInquiries } from "../../lib/contact-store";

const REPORT_CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/;

interface AdminPageProps {
    readonly searchParams: Promise<{
        readonly token?: string;
        readonly code?: string;
    }>;
}

function isAuthorised(token: string | undefined): boolean {
    const expected = process.env.ADMIN_TOKEN;
    if (!expected) return false;
    if (typeof token !== "string" || token.length === 0) return false;
    // reason: tiny constant-time-ish comparison; token is short and the route
    // is internal, so a length-aware loop is sufficient.
    if (token.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i += 1) {
        diff |= token.charCodeAt(i) ^ expected.charCodeAt(i);
    }
    return diff === 0;
}

export const dynamic = "force-dynamic";

export default async function AdminPage({ searchParams }: AdminPageProps) {
    const { token, code } = await searchParams;
    if (!isAuthorised(token)) notFound();

    const trimmedCode = (code ?? "").trim().toUpperCase();
    const hasCode = trimmedCode.length > 0;
    const validCode = hasCode && REPORT_CODE_RE.test(trimmedCode);

    const snapshot = validCode ? await loadReport(trimmedCode) : null;
    const inquiries = validCode ? await listContactInquiries(trimmedCode) : [];

    return (
        <main className="min-h-screen bg-[#f5efe6] px-6 py-12 sm:px-12">
            <div className="mx-auto max-w-3xl space-y-8">
                <header className="space-y-1">
                    <span className="text-xs uppercase tracking-widest text-stone-500">
                        Internal · Admin
                    </span>
                    <h1 className="text-2xl font-semibold text-stone-900">
                        Report Lookup
                    </h1>
                    <p className="text-sm text-stone-600">
                        Enter a 6-character report code to inspect the snapshot
                        and review submitted follow-up inquiries.
                    </p>
                </header>

                <form method="GET" className="flex flex-wrap items-end gap-3">
                    <input type="hidden" name="token" value={token ?? ""} />
                    <label className="flex flex-col gap-1 text-sm">
                        <span className="text-stone-600">Report code</span>
                        <input
                            type="text"
                            name="code"
                            defaultValue={trimmedCode}
                            placeholder="ABCDEF"
                            maxLength={6}
                            className="rounded-md border border-stone-300 bg-white px-3 py-2 font-mono uppercase tracking-widest"
                        />
                    </label>
                    <button
                        type="submit"
                        className="rounded-md bg-stone-900 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-700"
                    >
                        Look up
                    </button>
                </form>

                {hasCode && !validCode && (
                    <p className="text-sm text-amber-700">
                        Invalid report code format. Expected 6 characters using
                        the Crockford alphabet (A-H, J-N, P-Z, 2-9).
                    </p>
                )}

                {validCode && !snapshot && (
                    <p className="text-sm text-amber-700">
                        No report found for code{" "}
                        <code className="font-mono">{trimmedCode}</code>.
                    </p>
                )}

                {snapshot && (
                    <ReportSummary
                        snapshot={snapshot}
                        inquiries={inquiries}
                        viewLink={`/zh/r/${snapshot.code}`}
                    />
                )}
            </div>
        </main>
    );
}

function ReportSummary({
    snapshot,
    inquiries,
    viewLink,
}: {
    snapshot: NonNullable<Awaited<ReturnType<typeof loadReport>>>;
    inquiries: ReadonlyArray<
        Awaited<ReturnType<typeof listContactInquiries>>[number]
    >;
    viewLink: string;
}) {
    const totals = {
        stretch: snapshot.set.stretch.length,
        match: snapshot.set.match.length,
        safety: snapshot.set.safety.length,
    };
    return (
        <section className="space-y-6">
            <article className="space-y-3 rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="text-lg font-semibold text-stone-900">
                        Snapshot
                    </h2>
                    <Link
                        href={viewLink}
                        target="_blank"
                        className="text-sm text-stone-500 underline"
                    >
                        Open user-facing report
                    </Link>
                </div>
                <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                    <Row label="Code" value={snapshot.code} mono />
                    <Row
                        label="Created"
                        value={new Date(snapshot.created_at).toISOString()}
                    />
                    <Row
                        label="Target"
                        value={`${snapshot.profile.target_level} · ${snapshot.profile.target_field ?? "any"}`}
                    />
                    <Row
                        label="Budget (AUD/y)"
                        value={
                            snapshot.profile.annual_budget_aud == null
                                ? "—"
                                : String(snapshot.profile.annual_budget_aud)
                        }
                    />
                    <Row
                        label="Recommendations"
                        value={`${totals.stretch} stretch · ${totals.match} match · ${totals.safety} safety`}
                    />
                </dl>
            </article>

            <article className="space-y-3 rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-stone-900">
                    Follow-up inquiries{" "}
                    <span className="text-sm font-normal text-stone-500">
                        ({inquiries.length})
                    </span>
                </h2>
                {inquiries.length === 0 ? (
                    <p className="text-sm text-stone-500">
                        No inquiries submitted for this report yet.
                    </p>
                ) : (
                    <ol className="space-y-3">
                        {inquiries.map((inq, idx) => (
                            <li
                                key={`${inq.created_at}-${idx}`}
                                className="rounded-md border border-stone-200 bg-stone-50 p-3"
                            >
                                <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-stone-500">
                                    <span>
                                        {new Date(inq.created_at).toISOString()}
                                    </span>
                                    <span className="rounded bg-stone-200 px-2 py-0.5 font-mono uppercase tracking-widest">
                                        {inq.channel}
                                    </span>
                                </div>
                                <p className="mt-2 whitespace-pre-wrap text-sm text-stone-800">
                                    {inq.message}
                                </p>
                                <p className="mt-1 text-xs text-stone-400">
                                    locale: {inq.locale}
                                </p>
                            </li>
                        ))}
                    </ol>
                )}
            </article>
        </section>
    );
}

function Row({
    label,
    value,
    mono,
}: {
    label: string;
    value: string;
    mono?: boolean;
}) {
    return (
        <div className="flex justify-between gap-3 border-b border-stone-100 py-1 last:border-b-0">
            <dt className="text-stone-500">{label}</dt>
            <dd
                className={
                    mono
                        ? "font-mono tracking-widest text-stone-900"
                        : "text-stone-900"
                }
            >
                {value}
            </dd>
        </div>
    );
}
