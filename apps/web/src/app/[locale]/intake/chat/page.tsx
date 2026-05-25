import { ChatIntake } from "../../../../features/intake-chat/chat-intake";

export default function IntakeChatPage() {
    return (
        <main className="bg-bg min-h-screen w-full px-6 py-16 sm:px-12">
            <div className="mx-auto max-w-5xl space-y-10">
                <header className="space-y-2 text-center">
                    <span className="text-text-muted text-sm uppercase tracking-widest">
                        和顾问助手聊几句
                    </span>
                    <h1 className="text-text text-3xl font-bold leading-tight sm:text-4xl">
                        随便聊聊，直接看推荐
                    </h1>
                    <p className="text-text-muted mx-auto max-w-2xl">
                        不用填表，按你舒服的方式回答几个问题， 信息够了 AI 会直接生成报告，可以随时点「直接看推荐」跳过。
                    </p>
                </header>
                <ChatIntake />
            </div>
        </main>
    );
}
