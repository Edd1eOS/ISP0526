import { submitIntakeAction } from "../../../features/intake/intake-actions";
import { IntakeForm } from "../../../features/intake/intake-form";

export default function IntakeFormPage() {
    return (
        <main className="bg-bg min-h-screen w-full px-6 py-16 sm:px-12">
            <div className="mx-auto max-w-2xl space-y-10">
                <header className="space-y-2">
                    <span className="text-text-muted text-sm uppercase tracking-widest">
                        结构化表单
                    </span>
                    <h1 className="text-text text-3xl font-bold leading-tight sm:text-4xl">
                        告诉我们一点你的背景
                    </h1>
                    <p className="text-text-muted max-w-xl">
                        所有字段都可选。填得越多，推荐越精准。提交后会立刻生成你的报告。
                    </p>
                </header>
                <IntakeForm action={submitIntakeAction} />
            </div>
        </main>
    );
}
