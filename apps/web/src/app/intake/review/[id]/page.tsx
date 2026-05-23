import { notFound } from "next/navigation";
import { ReviewForm } from "../../../../features/intake-review/review-form";
import { loadIntakeSession } from "../../../../lib/intake-session-store";
import { isGoogleConfigured } from "../../../../lib/ai/google-narrative";

interface PageProps {
    readonly params: Promise<{ readonly id: string }>;
}

export default async function IntakeReviewPage({ params }: PageProps) {
    const { id } = await params;
    const session = await loadIntakeSession(id);
    if (!session) notFound();

    const fieldsExtracted =
        Object.values(session.extracted.academic).filter(Boolean).length +
        Object.values(session.extracted.budget).filter(Boolean).length;
    // If nothing was extracted AND we have no API key, the LLM never ran.
    // If something was extracted, the LLM clearly ran successfully.
    const llmUsed = fieldsExtracted > 0 || isGoogleConfigured();

    return (
        <main className="bg-bg min-h-screen w-full px-6 py-16 sm:px-12">
            <div className="mx-auto max-w-6xl space-y-8">
                <header className="space-y-2">
                    <span className="text-text-muted text-sm uppercase tracking-widest">
                        Step 2 · 核对装备
                    </span>
                    <h1 className="text-text text-3xl font-bold leading-tight sm:text-4xl">
                        AI 替你拎了重点，瞄两眼再出发
                    </h1>
                    <p className="text-text-muted max-w-3xl">
                        左边是 AI 读到的原文，右边是它整理出的字段。
                        绿牌「AI 高置信」基本可信；黄牌「请核对」最好瞄一眼；
                        改过的字段会变成灰色「已修改」。没问题就直接出报告。
                    </p>
                </header>
                <ReviewForm
                    sourceLabel={session.source.label}
                    sourceText={session.source.text}
                    extracted={session.extracted}
                    llmUsed={llmUsed}
                />
            </div>
        </main>
    );
}
