// Pure projection helper that maps the rich VoyageProfile (collected by
// the voyage step) down to the smaller ClarifyPatch shape consumed by
// finalizeChatIntakeAction. Kept out of voyage-actions.ts because that
// file is "use server" and Next.js forbids non-async exports there.
//
// All mappings are non-destructive: any field already present on the
// current ClarifyPatch is preserved.

import type { VoyageProfile } from "@isp0526/core";
import type { ClarifyPatch } from "../intake-clarify/clarify-schema";

const CITY_SIZE_MAP: Record<string, "mega" | "large" | "medium" | "small"> = {
    metro: "mega",
    large: "large",
    mid: "medium",
    town: "small",
};

const TAG_VALUES = [
    "field_top",
    "migration_friendly",
    "career_pipeline",
    "value_for_money",
    "scholarship_rich",
    "chinese_community",
] as const;

export function projectVoyageToClarifyPatch(
    voyage: VoyageProfile,
    current: ClarifyPatch,
): ClarifyPatch {
    const overlay: ClarifyPatch = {};

    // GPA — only fill if not set and the voyage GPA is on the 4.0 scale.
    if (
        current.gpa === undefined &&
        voyage.credentials?.gpa?.scale === "gpa_4" &&
        typeof voyage.credentials.gpa.value === "number" &&
        voyage.credentials.gpa.value <= 4
    ) {
        overlay.gpa = voyage.credentials.gpa.value;
    }

    // IELTS — only when the language test kind is IELTS.
    if (
        current.ielts_overall === undefined &&
        voyage.credentials?.language?.kind === "ielts" &&
        typeof voyage.credentials.language.overall === "number"
    ) {
        overlay.ielts_overall = voyage.credentials.language.overall;
    }

    // Budget.
    if (
        current.annual_budget_aud === undefined &&
        typeof voyage.funding?.annual_budget_aud === "number"
    ) {
        overlay.annual_budget_aud = Math.round(
            voyage.funding.annual_budget_aud,
        );
    }

    // City size mapping.
    if (current.city_size === undefined && voyage.geography?.city_size) {
        const mapped = CITY_SIZE_MAP[voyage.geography.city_size];
        if (mapped) overlay.city_size = mapped;
    }

    // Teaching style derived from peer competitiveness + teaching_likes.
    if (current.teaching_style === undefined) {
        const peer = voyage.field?.peer_competitiveness;
        const likes = voyage.field?.teaching_likes ?? [];
        const hasResearch = likes.includes("research") || likes.includes("lab");
        const hasProject =
            likes.includes("project") || likes.includes("internship");
        if (hasResearch && !hasProject) {
            overlay.teaching_style = "theory_heavy";
        } else if (hasProject && !hasResearch) {
            overlay.teaching_style = "applied_heavy";
        } else if (typeof peer === "number") {
            overlay.teaching_style =
                peer >= 1
                    ? "theory_heavy"
                    : peer <= -1
                        ? "applied_heavy"
                        : "balanced";
        }
    }

    // Preferred tags — accumulate from decisive_factors + funding signals.
    if (!current.preferred_tags || current.preferred_tags.length === 0) {
        const tags = new Set<(typeof TAG_VALUES)[number]>();
        const factors = new Set(voyage.signals?.decisive_factors ?? []);
        if (factors.has("ranking")) tags.add("field_top");
        if (factors.has("employability")) tags.add("career_pipeline");
        if (factors.has("cost")) tags.add("value_for_money");
        if (factors.has("network")) tags.add("chinese_community");
        const scholarPri = voyage.funding?.scholarship_priority ?? 0;
        if (scholarPri >= 2) tags.add("scholarship_rich");
        const sources = new Set(voyage.funding?.sources ?? []);
        if (sources.has("scholarship") && scholarPri >= 1) {
            tags.add("scholarship_rich");
        }
        const goalsPostGrad = voyage.goals?.post_grad;
        if (
            goalsPostGrad === "return_home" ||
            (voyage.goals?.motivations ?? []).includes("family")
        ) {
            tags.add("chinese_community");
        }
        if (
            goalsPostGrad === "stay_local" ||
            (voyage.goals?.motivations ?? []).includes("immigration")
        ) {
            tags.add("migration_friendly");
        }
        if (tags.size > 0) {
            overlay.preferred_tags = Array.from(tags);
        }
    }

    return overlay;
}
