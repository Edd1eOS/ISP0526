// Static data model for the Star Chart intake. Each "night" is a
// minimalist single-theme interaction. Nights are resolved dynamically
// at runtime from what the accumulated patch and assessment already
// know, so the user is never asked a question they have already
// answered upstream.
//
// Two kinds of nights:
//   - "picker"  : tap stars in a constellation
//   - "budget"  : a horizontal "light strip" with a traveling star,
//                 representing a linear amount choice
//
// Free-form "wish" input is no longer a night: it lives as a
// persistent astrolabe overlay that the user may open at any time
// during the picking phase. Its text is merged into the final
// diagnosis prompt only (no patch contribution).

import type { ClarifyPatch } from "../intake-clarify/clarify-schema";

/**
 * What a single picker star nudges the downstream profile toward.
 * Sparse on purpose: most stars only push one signal. Lists are unioned
 * across picks, scalars are taken from the first pick that sets them.
 */
export interface StarMeta {
    readonly target_level?: "bachelor" | "master" | "phd";
    /** Canonical FIELD_OPTIONS value, only when the star maps cleanly. */
    readonly target_field?: string;
    readonly teaching_style?: "theory_heavy" | "balanced" | "applied_heavy";
    readonly city_size?: "mega" | "large" | "medium" | "small";
    readonly annual_budget_aud?: number;
    readonly preferred_tags?: ReadonlyArray<
        | "field_top"
        | "migration_friendly"
        | "career_pipeline"
        | "value_for_money"
        | "scholarship_rich"
        | "chinese_community"
    >;
}

export interface StarDef {
    readonly id: string;
    readonly label: string;
    readonly hint?: string;
    /** Position in the night-sky viewport, percent (0..100). */
    readonly x: number;
    readonly y: number;
    /** Visual size hint, 1 = small, 2 = medium, 3 = bright. */
    readonly mag?: 1 | 2 | 3;
    readonly meta?: StarMeta;
}

/** Single anchor on the budget light-strip. */
export interface BudgetAnchor {
    /** Numeric value written to ClarifyPatch.annual_budget_aud (AUD/year). */
    readonly value: number;
    /** Short label rendered under the anchor. */
    readonly label: string;
    /** Horizontal position 0..100 along the strip. */
    readonly x: number;
}

interface NightBase {
    readonly id: string;
    readonly title: string;
    readonly subtitle: string;
}

export interface PickerNight extends NightBase {
    readonly kind: "picker";
    readonly minPicks: number;
    readonly maxPicks: number;
    readonly stars: ReadonlyArray<StarDef>;
    /** When true, selected star labels are stored as wish text instead of being
     *  applied to LedgerFacts via StarMeta. Used for supplementary context
     *  questions (exam route, post-grad background) whose answers don't map to
     *  the structured fact schema but still feed into diagnosis. */
    readonly storeAsWish?: boolean;
}

export interface BudgetNight extends NightBase {
    readonly kind: "budget";
    readonly anchors: ReadonlyArray<BudgetAnchor>;
}

/** Configuration for the always-available free-input astrolabe. */
export interface FreeWishConfig {
    readonly maxChars: number;
    readonly placeholder: string;
    readonly label: string;
}

export type NightDef = PickerNight | BudgetNight;

/** What the runtime resolver knows about the upstream state. */
export interface ResolverContext {
    readonly accumulated: ClarifyPatch;
    /** Already-derived values from /intake/assessment, if completed. */
    readonly assessmentTeachingStyle?: string;
    readonly assessmentCitySize?: string;
}

/** Aggregate state for the picking phase. */
export interface PickingState {
    /** picker night id -> ordered list of star ids. */
    readonly pickerPicks: Readonly<Record<string, ReadonlyArray<string>>>;
    /** budget night value, AUD/year. */
    readonly budget: number | null;
    /** free-form wish text. */
    readonly wishText: string;
}

/** Projector contract: pure function, no I/O. */
export type ProjectPicks = (
    state: PickingState,
    nights: ReadonlyArray<NightDef>,
) => ClarifyPatch;
