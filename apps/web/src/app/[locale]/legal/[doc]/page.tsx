import { promises as fs } from "node:fs";
import path from "node:path";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "../../../../i18n/navigation";

interface LegalPageProps {
    readonly params: Promise<{ locale: string; doc: string }>;
}

const DOC_MAP = {
    privacy: { file: "PRIVACY.md", titleKey: "privacyTitle" },
    disclaimer: { file: "DISCLAIMER.md", titleKey: "disclaimerTitle" },
    terms: { file: "TERMS.md", titleKey: "termsTitle" },
} as const;

type DocKey = keyof typeof DOC_MAP;

function isDocKey(value: string): value is DocKey {
    return Object.prototype.hasOwnProperty.call(DOC_MAP, value);
}

export function generateStaticParams() {
    return (Object.keys(DOC_MAP) as DocKey[]).map((doc) => ({ doc }));
}

async function readLegalDoc(file: string): Promise<string | null> {
    const target = path.join(process.cwd(), "..", "..", "legal", file);
    try {
        return await fs.readFile(target, "utf8");
    } catch {
        // Fallback for environments where cwd is the monorepo root
        try {
            return await fs.readFile(
                path.join(process.cwd(), "legal", file),
                "utf8",
            );
        } catch {
            return null;
        }
    }
}

export default async function LegalDocPage({ params }: LegalPageProps) {
    const { locale, doc } = await params;
    setRequestLocale(locale);
    if (!isDocKey(doc)) notFound();
    const entry = DOC_MAP[doc];
    const t = await getTranslations({ locale, namespace: "legal" });

    const raw = await readLegalDoc(entry.file);
    if (!raw) notFound();

    return (
        <main className="bg-bg min-h-screen w-full px-6 py-16 sm:px-12">
            <div className="mx-auto max-w-3xl space-y-6">
                <header className="space-y-2">
                    <Link
                        href="/"
                        className="text-text-muted inline-block text-sm underline"
                    >
                        {t("backHome")}
                    </Link>
                    <h1 className="text-text text-3xl font-bold">{t(entry.titleKey)}</h1>
                </header>
                <article className="space-y-3">
                    {renderMarkdown(raw)}
                </article>
            </div>
        </main>
    );
}

function renderMarkdown(source: string): React.ReactNode {
    const lines = source.split(/\r?\n/);
    const blocks: React.ReactNode[] = [];
    let paragraph: string[] = [];

    const flush = () => {
        if (paragraph.length === 0) return;
        const text = paragraph.join(" ").trim();
        if (text.length > 0) {
            blocks.push(
                <p
                    key={`p-${blocks.length}`}
                    className="text-text-muted text-sm leading-relaxed"
                >
                    {text}
                </p>,
            );
        }
        paragraph = [];
    };

    for (const line of lines) {
        if (/^\s*$/.test(line)) {
            flush();
            continue;
        }
        const trimmed = line.trim();
        if (trimmed.startsWith("###")) {
            flush();
            blocks.push(
                <h3
                    key={`h3-${blocks.length}`}
                    className="text-text pt-4 text-base font-semibold"
                >
                    {trimmed.replace(/^###\s*/, "")}
                </h3>,
            );
            continue;
        }
        if (trimmed.startsWith("##")) {
            flush();
            blocks.push(
                <h2
                    key={`h2-${blocks.length}`}
                    className="text-text pt-6 text-xl font-semibold"
                >
                    {trimmed.replace(/^##\s*/, "")}
                </h2>,
            );
            continue;
        }
        if (trimmed.startsWith("#")) {
            flush();
            // Top-level # is the document title; we render our own title above.
            continue;
        }
        if (trimmed.startsWith(">")) {
            flush();
            blocks.push(
                <blockquote
                    key={`bq-${blocks.length}`}
                    className="text-text-muted border-l-2 pl-3 text-xs italic"
                    style={{ borderColor: "var(--color-surface-alt)" }}
                >
                    {trimmed.replace(/^>\s*/, "")}
                </blockquote>,
            );
            continue;
        }
        if (/^[-*]\s/.test(trimmed)) {
            flush();
            blocks.push(
                <li
                    key={`li-${blocks.length}`}
                    className="text-text-muted ml-4 list-disc text-sm leading-relaxed"
                >
                    {trimmed.replace(/^[-*]\s+/, "")}
                </li>,
            );
            continue;
        }
        paragraph.push(trimmed);
    }
    flush();

    return blocks;
}
