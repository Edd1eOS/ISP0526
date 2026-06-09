// Project the user's nightly picks into a ClarifyPatch the rest of the
// intake pipeline already understands, plus a labels-only structure for
// the end-flow diagnosis prompt.
//
// Pure function: no I/O, no LLM. Deterministic so the diagnosis prompt is
// re-runnable on the same picks.

import type { ClarifyPatch } from "../intake-clarify/clarify-schema";
import type { StarPickLine } from "@isp0526/core";
import type { NightDef, PickingState, StarMeta } from "./types";

const TAG_VALUES = [
    "field_top",
    "migration_friendly",
    "career_pipeline",
    "value_for_money",
    "scholarship_rich",
    "chinese_community",
] as const;

type Tag = (typeof TAG_VALUES)[number];

export interface ProjectedPicks {
    readonly patch: ClarifyPatch;
    readonly lines: ReadonlyArray<StarPickLine>;
}

function formatBudgetLabel(value: number): string {
    if (value < 1000) return `${value} AUD/年`;
    const wan = (value / 10000).toFixed(value % 10000 === 0 ? 0 : 1);
    return `${wan} 万 AUD/年`;
}

export function projectStarPicks(
    state: PickingState,
    nights: ReadonlyArray<NightDef>,
): ProjectedPicks {
    const patch: {
        target_level?:
            | "foundation"
            | "pathway"
            | "diploma"
            | "bachelor"
            | "master"
            | "phd";
        target_field?: string;
        teaching_style?: "theory_heavy" | "balanced" | "applied_heavy";
        city_size?: "mega" | "large" | "medium" | "small";
        annual_budget_aud?: number;
        preferred_tags: Tag[];
    } = { preferred_tags: [] };

    const lines: StarPickLine[] = [];

    for (const night of nights) {
        if (night.kind === "picker") {
            const ids = state.pickerPicks[night.id] ?? [];
            const labelMap = new Map(night.stars.map((s) => [s.id, s]));
            const labels: string[] = [];
            for (const id of ids) {
                const star = labelMap.get(id);
                if (!star) continue;
                labels.push(star.label);
                applyMeta(patch, star.meta);
            }
            if (labels.length > 0) {
                lines.push({ night: night.title, picks: labels });
            }
        } else if (night.kind === "budget") {
            if (state.budget != null) {
                if (patch.annual_budget_aud == null) {
                    patch.annual_budget_aud = state.budget;
                }
                lines.push({
                    night: night.title,
                    picks: [formatBudgetLabel(state.budget)],
                });
            }
        }
        // The wishText is passed separately to the diagnosis prompt
        // and does not contribute to the structured patch.
    }

    const out: ClarifyPatch = {};
    if (patch.target_level) out.target_level = patch.target_level;
    if (patch.target_field) out.target_field = patch.target_field;
    if (patch.teaching_style) out.teaching_style = patch.teaching_style;
    if (patch.city_size) out.city_size = patch.city_size;
    if (patch.annual_budget_aud != null)
        out.annual_budget_aud = patch.annual_budget_aud;
    if (patch.preferred_tags.length > 0)
        out.preferred_tags = patch.preferred_tags;

    return { patch: out, lines };
}

function applyMeta(
    patch: {
        target_level?:
            | "foundation"
            | "pathway"
            | "diploma"
            | "bachelor"
            | "master"
            | "phd";
        target_field?: string;
        teaching_style?: "theory_heavy" | "balanced" | "applied_heavy";
        city_size?: "mega" | "large" | "medium" | "small";
        annual_budget_aud?: number;
        preferred_tags: Tag[];
    },
    meta: StarMeta | undefined,
): void {
    if (!meta) return;
    if (meta.target_level && !patch.target_level)
        patch.target_level = meta.target_level;
    if (meta.target_field && !patch.target_field)
        patch.target_field = meta.target_field;
    if (meta.teaching_style && !patch.teaching_style)
        patch.teaching_style = meta.teaching_style;
    if (meta.city_size && !patch.city_size) patch.city_size = meta.city_size;
    if (meta.annual_budget_aud != null && patch.annual_budget_aud == null)
        patch.annual_budget_aud = meta.annual_budget_aud;
    if (meta.preferred_tags) {
        for (const t of meta.preferred_tags) {
            if (!patch.preferred_tags.includes(t)) patch.preferred_tags.push(t);
        }
    }
}
