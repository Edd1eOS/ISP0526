import { VoiceOrb } from "../../../features/intake-voice/voice-orb";

export default function IntakeVoicePage() {
    return (
        <main className="bg-bg min-h-screen w-full px-6 py-16 sm:px-12">
            <div className="mx-auto max-w-3xl space-y-10">
                <header className="space-y-2">
                    <span className="text-text-muted text-sm uppercase tracking-widest">
                        展开说说
                    </span>
                    <h1 className="text-text text-3xl font-bold leading-tight sm:text-4xl">
                        按住麦克风，把你的脑洞讲一遍
                    </h1>
                    <p className="text-text-muted max-w-2xl">
                        最长 60 秒，想说啥说啥——目标专业、预算、心仪城市、未来想干嘛都行。说完 AI 会把关键信息抠出来，下一步你只要核对。
                    </p>
                </header>
                <VoiceOrb />
            </div>
        </main>
    );
}
