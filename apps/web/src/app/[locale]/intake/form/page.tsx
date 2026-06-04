import { submitIntakeAction } from "../../../../features/intake/intake-actions";
import { IntakeForm } from "../../../../features/intake/intake-form";

export default function IntakeFormPage() {
    return (
        <main className="bg-bg flex min-h-screen w-full items-center justify-center px-6 py-16 sm:px-12">
            <div className="mx-auto w-full max-w-3xl space-y-10">
                <header className="space-y-2">
                    <span className="text-text-muted text-sm uppercase tracking-widest">
                        填写信息
                    </span>
                    <h1 className="text-text text-3xl font-bold leading-tight sm:text-4xl">
                        补充你的申请偏好
                    </h1>
                    <p className="text-text-muted max-w-xl">
                        不确定的项目可以先跳过。信息越完整，后续推荐越准确。
                    </p>
                </header>
                <IntakeForm action={submitIntakeAction} />
            </div>
        </main>
    );
}
