import { submitIntakeAction } from "../../../../features/intake/intake-actions";
import { IntakeForm } from "../../../../features/intake/intake-form";

export default function IntakeFormPage() {
    return (
        <main className="bg-bg min-h-screen w-full px-6 py-16 sm:px-12">
            <div className="mx-auto max-w-2xl space-y-10">
                <header className="space-y-2">
                    <span className="text-text-muted text-sm uppercase tracking-widest">
                        填个表
                    </span>
                    <h1 className="text-text text-3xl font-bold leading-tight sm:text-4xl">
                        把你的故事勾几个选项给我
                    </h1>
                    <p className="text-text-muted max-w-xl">
                        每一项都可以跳过，但写得越多 AI 越懂你。提交后立刻翻开属于你的那张报告。
                    </p>
                </header>
                <IntakeForm action={submitIntakeAction} />
            </div>
        </main>
    );
}
