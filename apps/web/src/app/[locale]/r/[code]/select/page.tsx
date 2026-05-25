import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import type { Country } from "@isp0526/core";
import { loadReport } from "../../../../../lib/report-store";
import { SelectionForm, type PickableProgram } from "../../../../../features/plan/selection-form";

interface SelectPageProps {
    readonly params: Promise<{ code: string; locale: string }>;
}

const COUNTRY_LABEL: Record<Country, string> = {
    AU: "澳大利亚",
    UK: "英国",
    CA: "加拿大",
    US: "美国",
    NZ: "新西兰",
    HK: "香港",
    SG: "新加坡",
};

export default async function SelectPage({ params }: SelectPageProps) {
    const { code, locale } = await params;
    setRequestLocale(locale);
    const snapshot = await loadReport(code);
    if (!snapshot) notFound();
    const snap = snapshot;

    function toPickable(
        scores: typeof snap.set.match,
        tier: "stretch" | "match" | "safety",
    ): PickableProgram[] {
        return scores.map((s) => {
            const cand = snap.candidates.get(s.program_id);
            const narr = snap.narratives.get(s.program_id);
            return {
                programId: s.program_id,
                tier,
                score: Math.round(s.final_score),
                universityName:
                    cand?.university.name_zh ?? cand?.university.name_en ?? "",
                programName:
                    cand?.program.name_zh ?? cand?.program.name_en ?? s.program_id,
                country: cand
                    ? COUNTRY_LABEL[cand.university.country]
                    : undefined,
                countryCode: cand?.university.country,
                city: cand?.university.city ?? null,
                headline: narr?.headline ?? null,
            };
        });
    }

    const reach = toPickable(snapshot.set.stretch, "stretch");
    const matchT = toPickable(snapshot.set.match, "match");
    const safety = toPickable(snapshot.set.safety, "safety");

    return (
        <main className="bg-bg min-h-screen w-full px-6 py-10 sm:px-12">
            <div className="mx-auto max-w-5xl space-y-6">
                <header className="space-y-2">
                    <span className="text-text-muted text-xs tracking-widest">
                        报告编号 · {snapshot.code}
                    </span>
                    <h1 className="text-text text-2xl font-bold sm:text-3xl">
                        选 6 所，开始拼方案
                    </h1>
                    <p className="text-text-muted text-sm">
                        从推荐里挑出 2 所冲、3 所稳、1 所保。选完进入方案页，自动排时间轴和资料清单。
                    </p>
                </header>

                <SelectionForm
                    code={snapshot.code}
                    locale={locale}
                    reach={reach}
                    match={matchT}
                    safety={safety}
                />
            </div>
        </main>
    );
}
