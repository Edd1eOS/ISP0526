import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "../../../i18n/navigation";

interface Door {
    readonly href: "/intake/form" | "/intake/upload" | "/intake/assessment";
    readonly icon: string;
    readonly key: "form" | "upload" | "chat";
    readonly ready: boolean;
}

const DOORS: ReadonlyArray<Door> = [
    { href: "/intake/form", icon: "📝", key: "form", ready: true },
    { href: "/intake/upload", icon: "📄", key: "upload", ready: true },
    // The chat door starts with the 15-item Step-3 assessment so the chat
    // can be guided by the resulting personality + preference signals.
    { href: "/intake/assessment", icon: "💬", key: "chat", ready: true },
];

export default async function IntakeHubPage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    setRequestLocale(locale);
    const t = await getTranslations("intakeHub");

    return (
        <main className="bg-bg min-h-screen w-full px-6 py-16 sm:px-12">
            <div className="mx-auto max-w-4xl space-y-10">
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

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    {DOORS.map((door) => (
                        <DoorCard key={door.href} door={door} />
                    ))}
                </div>
            </div>
        </main>
    );
}

async function DoorCard({ door }: { door: Door }) {
    const t = await getTranslations(`intakeHub.doors.${door.key}`);
    const tHub = await getTranslations("intakeHub");
    const inner = (
        <div className="flex h-full flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
                <span className="text-4xl leading-none" aria-hidden>
                    {door.icon}
                </span>
                {!door.ready ? (
                    <span
                        className="text-text-muted rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider"
                        style={{ background: "var(--color-surface-alt)" }}
                    >
                        {tHub("comingSoon")}
                    </span>
                ) : null}
            </div>
            <h2 className="text-text text-xl font-semibold">{t("title")}</h2>
            <p className="text-text-muted text-sm">{t("tagline")}</p>
            <p className="text-text-muted mt-auto text-xs leading-relaxed">
                {t("hint")}
            </p>
        </div>
    );

    const baseClasses = "block h-full p-6 transition-transform sm:p-7";
    const baseStyle = {
        background: "var(--gradient-raised)",
        borderRadius: "var(--radius-card-md)",
        boxShadow: "var(--shadow-clay-card)",
    } as const;

    if (!door.ready) {
        return (
            <div
                aria-disabled
                className={`${baseClasses} cursor-not-allowed opacity-60`}
                style={baseStyle}
            >
                {inner}
            </div>
        );
    }

    return (
        <Link
            href={door.href}
            className={`${baseClasses} hover:-translate-y-0.5 active:scale-[0.99]`}
            style={baseStyle}
        >
            {inner}
        </Link>
    );
}

