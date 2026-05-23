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
        title: "结构化表单",
        tagline: "我自己知道想要什么",
        hint: "30 秒填完关键字段，立刻出报告。",
        ready: true,
    },
    {
        href: "/intake/upload",
        icon: "📄",
        title: "上传文件",
        tagline: "我有简历 / 成绩单 / 录取信",
        hint: "AI 帮你抽出关键字段，你只需审阅。",
        ready: true,
    },
    {
        href: "/intake/voice",
        icon: "🎙",
        title: "语音输入",
        tagline: "我想边走边说",
        hint: "录一段话，AI 自动转录并填表。",
        ready: false,
    },
    {
        href: "/intake/chat",
        icon: "💬",
        title: "对话助手",
        tagline: "我喜欢被一步步问到",
        hint: "聊天式收集信息，按你的节奏来。",
        ready: false,
    },
];

export default function IntakeHubPage() {
    return (
        <main className="bg-bg min-h-screen w-full px-6 py-16 sm:px-12">
            <div className="mx-auto max-w-4xl space-y-10">
                <header className="space-y-2 text-center">
                    <span className="text-text-muted text-sm uppercase tracking-widest">
                        Step 1 · 选择采集方式
                    </span>
                    <h1 className="text-text text-3xl font-bold leading-tight sm:text-4xl">
                        你想怎么开始？
                    </h1>
                    <p className="text-text-muted mx-auto max-w-xl">
                        四种方式抵达同一份报告。任选一种，过程中可以随时切换或补充。
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
                        即将上线
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

