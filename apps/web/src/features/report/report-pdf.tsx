// Server-only PDF document for a recommendation report.
//
// Renders via @react-pdf/renderer. The Chinese typeface is loaded from a
// public CDN at first render and cached by the runtime; if the network
// fetch fails, react-pdf falls back to Helvetica and Chinese characters
// will render as boxes. There is no try/catch around Font.register because
// the call itself does not throw — the failure happens inside renderToStream
// and is surfaced to the route handler.

import {
    Document,
    Font,
    Page,
    StyleSheet,
    Text,
    View,
} from "@react-pdf/renderer";
import type {
    Candidate,
    RecommendationNarrative,
    Score,
    StudentProfile,
} from "@isp0526/core";

// Noto Sans SC Regular, static OTF served from jsDelivr (notofonts/noto-cjk).
const CHINESE_FONT_URL =
    "https://cdn.jsdelivr.net/gh/notofonts/noto-cjk@main/Sans/OTF/SimplifiedChinese/NotoSansSC-Regular.otf";

let fontsRegistered = false;
function ensureFontsRegistered(): void {
    if (fontsRegistered) return;
    Font.register({ family: "NotoSansSC", src: CHINESE_FONT_URL });
    // Disable hyphenation; it breaks CJK lines.
    Font.registerHyphenationCallback((w) => [w]);
    fontsRegistered = true;
}

const styles = StyleSheet.create({
    page: {
        fontFamily: "NotoSansSC",
        fontSize: 10,
        lineHeight: 1.5,
        color: "#1a1f2e",
        backgroundColor: "#f4f0ea",
        paddingHorizontal: 36,
        paddingVertical: 40,
    },
    header: {
        marginBottom: 18,
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: "#d6d0c4",
        borderBottomStyle: "solid",
    },
    code: {
        fontSize: 9,
        color: "#7a7466",
        letterSpacing: 1,
        marginBottom: 4,
    },
    title: { fontSize: 18, fontWeight: 700, marginBottom: 6 },
    subtitle: { fontSize: 10, color: "#5a5446" },
    sectionTitle: {
        fontSize: 13,
        fontWeight: 700,
        marginTop: 14,
        marginBottom: 8,
    },
    card: {
        backgroundColor: "#ffffff",
        borderRadius: 8,
        padding: 14,
        marginBottom: 10,
    },
    rowHead: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 4,
    },
    progName: { fontSize: 12, fontWeight: 700, flex: 1, paddingRight: 8 },
    score: { fontSize: 11, fontWeight: 700, color: "#1a1f2e" },
    uniLine: { fontSize: 9, color: "#7a7466", marginBottom: 6 },
    headline: { fontSize: 10, fontWeight: 700, marginTop: 6, marginBottom: 4 },
    summary: { fontSize: 9.5, color: "#3a3528", marginBottom: 6 },
    bullet: {
        flexDirection: "row",
        marginBottom: 2,
        paddingLeft: 4,
    },
    bulletDot: { fontSize: 9, width: 8 },
    bulletText: { fontSize: 9, flex: 1 },
    profileBox: {
        backgroundColor: "#ffffff",
        borderRadius: 8,
        padding: 12,
        marginBottom: 12,
    },
    profileRow: { flexDirection: "row", marginBottom: 2 },
    profileLabel: {
        fontSize: 9,
        color: "#7a7466",
        width: 70,
    },
    profileValue: { fontSize: 9, flex: 1 },
    footer: {
        position: "absolute",
        bottom: 24,
        left: 36,
        right: 36,
        fontSize: 8,
        color: "#9a9486",
        textAlign: "center",
    },
});

export interface ReportPdfProps {
    readonly code: string;
    readonly createdAt: string;
    readonly profile: StudentProfile;
    readonly sections: ReadonlyArray<{
        readonly key: string;
        readonly title: string;
        readonly scores: ReadonlyArray<Score>;
    }>;
    readonly candidates: ReadonlyMap<string, Candidate>;
    readonly narratives: ReadonlyMap<string, RecommendationNarrative>;
}

export function ReportPdfDocument(props: ReportPdfProps) {
    ensureFontsRegistered();
    const { code, createdAt, profile, sections, candidates, narratives } = props;

    const dateStr = new Date(createdAt).toLocaleDateString("zh-CN");
    const totalCount = sections.reduce((n, s) => n + s.scores.length, 0);

    return (
        <Document
            title={`留学推荐报告 ${code}`}
            author="一站式留学启动器"
            creator="ISP0526"
        >
            <Page size="A4" style={styles.page} wrap>
                <View style={styles.header}>
                    <Text style={styles.code}>REPORT · {code}</Text>
                    <Text style={styles.title}>你的澳洲院校推荐</Text>
                    <Text style={styles.subtitle}>
                        {dateStr} 生成 · 共 {totalCount} 项推荐 ·
                        所有结论来自规则引擎，可追溯到原始来源
                    </Text>
                </View>

                <Text style={styles.sectionTitle}>申请画像</Text>
                <View style={styles.profileBox}>
                    {renderProfileRow("学位层次", profile.academic.target_level)}
                    {renderProfileRow(
                        "方向",
                        profile.academic.target_field ?? "未填",
                    )}
                    {renderProfileRow(
                        "GPA",
                        typeof profile.academic.gpa === "number"
                            ? profile.academic.gpa.toFixed(2)
                            : "未填",
                    )}
                    {renderProfileRow(
                        "IELTS",
                        typeof profile.academic.ielts_overall === "number"
                            ? String(profile.academic.ielts_overall)
                            : "未填",
                    )}
                    {renderProfileRow(
                        "年预算 (AUD)",
                        typeof profile.budget.annual_aud === "number"
                            ? `A$${profile.budget.annual_aud.toLocaleString()}`
                            : "未填",
                    )}
                </View>

                {sections.map((section) => (
                    <View key={section.key} wrap>
                        <Text style={styles.sectionTitle}>
                            {section.title} · {section.scores.length} 项
                        </Text>
                        {section.scores.length === 0 ? (
                            <Text style={styles.subtitle}>这一档暂无匹配。</Text>
                        ) : (
                            section.scores.map((score) => {
                                const cand = candidates.get(score.program_id);
                                const narr = narratives.get(score.program_id);
                                if (!cand) return null;
                                return (
                                    <ProgramCard
                                        key={score.program_id}
                                        score={score}
                                        candidate={cand}
                                        narrative={narr}
                                    />
                                );
                            })
                        )}
                    </View>
                ))}

                <Text
                    style={styles.footer}
                    fixed
                    render={({ pageNumber, totalPages }) =>
                        `${code} · 第 ${pageNumber} / ${totalPages} 页 · 报告 ID 即查询凭证，妥善保存`
                    }
                />
            </Page>
        </Document>
    );
}

function renderProfileRow(label: string, value: string) {
    return (
        <View style={styles.profileRow}>
            <Text style={styles.profileLabel}>{label}</Text>
            <Text style={styles.profileValue}>{value}</Text>
        </View>
    );
}

function ProgramCard({
    score,
    candidate,
    narrative,
}: {
    readonly score: Score;
    readonly candidate: Candidate;
    readonly narrative: RecommendationNarrative | undefined;
}) {
    return (
        <View style={styles.card} wrap={false}>
            <View style={styles.rowHead}>
                <Text style={styles.progName}>{candidate.program.name_zh}</Text>
                <Text style={styles.score}>{score.final_score.toFixed(0)}</Text>
            </View>
            <Text style={styles.uniLine}>
                {candidate.university.name_zh} · {candidate.university.city} ·{" "}
                {candidate.program.duration_years} 年
            </Text>
            {narrative ? (
                <>
                    <Text style={styles.headline}>{narrative.headline}</Text>
                    <Text style={styles.summary}>{narrative.summary}</Text>
                    {narrative.pros.map((p, i) => (
                        <View key={`p-${i}`} style={styles.bullet}>
                            <Text style={styles.bulletDot}>+</Text>
                            <Text style={styles.bulletText}>{p.text}</Text>
                        </View>
                    ))}
                    {narrative.cons.map((c, i) => (
                        <View key={`c-${i}`} style={styles.bullet}>
                            <Text style={styles.bulletDot}>-</Text>
                            <Text style={styles.bulletText}>{c.text}</Text>
                        </View>
                    ))}
                </>
            ) : (
                <Text style={styles.summary}>暂无文案。</Text>
            )}
        </View>
    );
}
