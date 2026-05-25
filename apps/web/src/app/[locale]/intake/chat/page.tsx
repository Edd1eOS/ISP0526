import { ChatIntake } from "../../../../features/intake-chat/chat-intake";

export default function IntakeChatPage() {
    return (
        <main className="bg-bg min-h-screen w-full px-6 py-16 sm:px-12">
            <div className="mx-auto max-w-5xl space-y-10">
                <header className="space-y-2 text-center">
                    <span className="text-text-muted text-sm uppercase tracking-widest">
                        Step 1 · 聊会天
                    </span>
                    <h1 className="text-text text-3xl font-bold leading-tight sm:text-4xl">
                        三个问题，把你的想法理清楚
                    </h1>
                    <p className="text-text-muted mx-auto max-w-2xl">
                        不用想措辞，怎么说怎么写。
                        AI 读完会把关键信息整理成可编辑的字段，下一步你来核对。
                    </p>
                </header>
                <ChatIntake />
            </div>
        </main>
    );
}
