"use server";

// Server actions for the star-chart end flow.
// - diagnoseStarsAction: single LLM call returning a short readout.
// - generateNextAdaptiveQuestionAction: LLM-driven next question in the adaptive phase.
// - parseWishAction: parse free-form wish text for extraction / backtrack / answer.
// - finalizeStarsAction: projects picks to ClarifyPatch and hands off to
//   the existing recommender pipeline.

import { redirect } from "next/navigation";
import {
    generateAdaptiveQuestion,
    generateStarDiagnosis,
    parseWish,
    type AdaptiveQuestionResult,
    type ConversationTurnInput,
    type StarDiagnosis,
    type StarPickLine,
    type WishExtracted,
    type WishParseResult,
} from "@isp0526/core";
import { buildGoogleAdaptiveQuestionGenerator } from "../../lib/ai/google-adaptive-question";
import { buildGoogleStarDiagnosisGenerator } from "../../lib/ai/google-star-diagnosis";
import { buildGoogleWishParseGenerator } from "../../lib/ai/google-wish-parse";
import { finalizeChatIntakeAction } from "../intake-chat/chat-actions";
import { mergePatchDeep } from "../intake-chat/intake-state";
import type { ClarifyPatch } from "../intake-clarify/clarify-schema";
import type { AssessmentAnswers } from "../assessment/items";

export interface DiagnoseInput {
    readonly locale: "zh" | "en";
    readonly lines: ReadonlyArray<StarPickLine>;
    readonly bigFive?: Readonly<Record<string, number>>;
    readonly wishText?: string;
}

export interface DiagnoseOutput {
    readonly ok: boolean;
    readonly diagnosis?: StarDiagnosis;
    readonly error?: string;
}

export async function diagnoseStarsAction(
    input: DiagnoseInput,
): Promise<DiagnoseOutput> {
    const result = await generateStarDiagnosis({
        locale: input.locale,
        picks: input.lines,
        ...(input.bigFive ? { bigFive: input.bigFive } : {}),
        ...(input.wishText ? { wishText: input.wishText } : {}),
        generate: buildGoogleStarDiagnosisGenerator(),
    });
    if (!result.ok) {
        return { ok: false, error: result.error.message };
    }
    return { ok: true, diagnosis: result.value };
}

export async function finalizeStarsAction(
    overlay: ClarifyPatch,
    accumulated: ClarifyPatch,
    assessment?: AssessmentAnswers,
): Promise<void> {
    const merged = mergePatchDeep(accumulated, overlay);
    await finalizeChatIntakeAction(merged, assessment);
    // finalizeChatIntakeAction issues a redirect; control never returns.
    redirect("/");
}

// ---------------------------------------------------------------------------
// generateNextAdaptiveQuestionAction
// ---------------------------------------------------------------------------

export interface AdaptiveQuestionInput {
    readonly locale: "zh" | "en";
    readonly knownFacts?: Readonly<Record<string, string>>;
    readonly history: ReadonlyArray<ConversationTurnInput>;
    readonly questionCount: number;
    readonly maxQuestions: number;
    readonly riasec?: Readonly<Partial<Record<
        "realistic" | "investigative" | "artistic" | "social" | "enterprising" | "conventional",
        number
    >>>;
    readonly freeNotes?: string;
}

export interface AdaptiveQuestionOutput {
    readonly ok: boolean;
    readonly result?: AdaptiveQuestionResult;
    readonly error?: string;
}

export async function generateNextAdaptiveQuestionAction(
    input: AdaptiveQuestionInput,
): Promise<AdaptiveQuestionOutput> {
    const result = await generateAdaptiveQuestion({
        locale: input.locale,
        history: input.history,
        questionCount: input.questionCount,
        maxQuestions: input.maxQuestions,
        ...(input.knownFacts ? { knownFacts: input.knownFacts } : {}),
        ...(input.riasec ? { riasec: input.riasec } : {}),
        ...(input.freeNotes ? { freeNotes: input.freeNotes } : {}),
        generate: buildGoogleAdaptiveQuestionGenerator(),
    });
    if (!result.ok) {
        return { ok: false, error: result.error.message };
    }
    return { ok: true, result: result.value };
}

// ---------------------------------------------------------------------------
// parseWishAction
// ---------------------------------------------------------------------------

export interface ParseWishInput {
    readonly locale: "zh" | "en";
    readonly wishText: string;
    readonly currentFacts?: Readonly<Record<string, string>>;
    readonly currentQuestionContext?: string;
}

export interface ParseWishOutput {
    readonly ok: boolean;
    readonly result?: WishParseResult;
    readonly error?: string;
}

export async function parseWishAction(
    input: ParseWishInput,
): Promise<ParseWishOutput> {
    const result = await parseWish({
        locale: input.locale,
        wishText: input.wishText,
        ...(input.currentFacts ? { currentFacts: input.currentFacts } : {}),
        ...(input.currentQuestionContext ? { currentQuestionContext: input.currentQuestionContext } : {}),
        generate: buildGoogleWishParseGenerator(),
    });
    if (!result.ok) {
        return { ok: false, error: result.error.message };
    }
    return { ok: true, result: result.value };
}
