import Link from "next/link";

interface Door {
    readonly href: string;
    readonly icon: string;
    readonly title: string;
    readonly tagline: string;
    readonly hint: string;
    readonly ready: boolean;
}

const DOORS: ReadonlyArray<Door> = [
    {
        href: "/intake/form",
        icon: "📝",
        title: "填个表",
        tagline: "我对一切都了如指掌",
        hint: "30 秒勾几个选项，立刻翻开你的报告。",
        ready: true,
    },
    {
        href: "/intake/upload",
        icon: "📄",
        title: "传个文件",
        tagline: "我有迹可循的远大前程",
        hint: "简历 / 成绩单 / 录取信丢进来，让 AI 帮你抠重点。",
        ready: true,
    },
    {
        href: "/intake/voice",
        icon: "🎙",
        title: "展开说说",
        tagline: "freestyle 一段超乎想象的未来",
        hint: "按住说话，AI 把你的脑洞整理成档案。",
        ready: false,
    },
    {
        href: "/intake/chat",
        icon: "💬",
        title: "聊会天",
        tagline: "未来的我有话要说？去看看！",
        hint: "一问一答，AI 陪你把想法慢慢理清楚。",
        ready: false,
    },
];

export default function IntakeHubPage() {
    return (
        <main className="bg-bg min-h-screen w-full px-6 py-16 sm:px-12">
            <div className="mx-auto max-w-4xl space-y-10">
                <header className="space-y-2 text-center">
                    <span className="text-text-muted text-sm uppercase tracking-widest">
                        Step 1 · 选个入口
                    </span>
                    <h1 className="text-text text-3xl font-bold leading-tight sm:text-4xl">
                        请选择你开启留学副本的方式
                    </h1>
                    <p className="text-text-muted mx-auto max-w-xl">
                        四道门，通往同一份属于你的报告。挑一道喜欢的，进去就行——中途想换也随时可以。
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

function DoorCard({ door }: { door: Door }) {
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
                        敬请期待
                    </span>
                ) : null}
            </div>
            <h2 className="text-text text-xl font-semibold">{door.title}</h2>
            <p className="text-text-muted text-sm">{door.tagline}</p>
            <p className="text-text-muted mt-auto text-xs leading-relaxed">
                {door.hint}
            </p>
        </div>
    );

    const baseClasses =
        "block h-full p-6 transition-transform sm:p-7";

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

