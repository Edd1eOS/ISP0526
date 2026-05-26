// Voyage detail-refinement prompt.
//
// This is the LLM brain behind the first-person sailing UI. Instead of the
// rigid ClarifyPatch field-by-field FSM, the model is given the whole
// detailed profile that the recommender ultimately wants filled, plus the
// turn-by-turn history, and on each call it does two things:
//
//   1. Distill the user's last answer into a partial patch that we
//      deep-merge into the accumulated VoyageProfile.
//   2. Pick the single most decision-useful follow-up question and return
//      it together with the right input mode (choice / multi / scale /
//      free / number) plus a one-sentence rationale.
//
// The schema is intentionally broad: positive AND negative preferences,
// confirmation flags, dealbreakers, decisive factors. The model is
// expected to bias toward "what's still empty and matters most for the
// recommender" each turn, and to alternate between positive ("你最看重
// 什么") and negative ("最不能接受什么") framing so the resulting profile
// is informative on both axes.

import { z } from "zod";

import type { Locale } from "./recommendation-narrative";

export type { Locale };

// ---------- Detailed profile ----------

const Direction = z.enum(["love", "like", "neutral", "dislike", "hate"]);

const TeachingStyle = z.enum([
    "lecture",
    "seminar",
    "project",
    "internship",
    "research",
    "case_study",
    "lab",
]);

const AssessmentStyle = z.enum([
    "exam",
    "coursework",
    "presentation",
    "group_project",
    "dissertation",
]);

const ClimateBucket = z.enum([
    "warm_dry",
    "warm_humid",
    "temperate",
    "cold",
]);

const Country = z.object({
    code: z.string().min(2).max(8),
    direction: Direction,
    reason: z.string().max(80).optional(),
});

const ExcludedCountry = z.object({
    code: z.string().min(2).max(8),
    reason: z.string().max(80).optional(),
});

const GpaScale = z.enum([
    "gpa_4",
    "gpa_5",
    "percentage_100",
    "wam_100",
    "uk_class",
    "other",
]);

export const VoyageProfileSchema = z
    .object({
        // Applicant stage — prerequisite axis. Most downstream questions
        // (university GPA, work experience, research experience, program
        // level preferences) only make sense once these are known. The
        // model MUST establish these in the first 1-2 turns before asking
        // level-specific questions.
        stage: z
            .object({
                current_education: z
                    .enum([
                        "high_school_inprogress",
                        "high_school_grad",
                        "undergrad_inprogress",
                        "bachelor_holder",
                        "master_inprogress",
                        "master_holder",
                        "working_professional",
                        "other",
                    ])
                    .optional(),
                target_level: z
                    .enum([
                        "undergrad",
                        "master_coursework",
                        "master_research",
                        "phd",
                        "exchange",
                        "prep_pathway",
                        "unsure",
                    ])
                    .optional(),
                target_intake: z
                    .enum([
                        "this_semester",
                        "next_semester",
                        "this_year",
                        "next_year",
                        "later",
                    ])
                    .optional(),
            })
            .partial()
            .optional(),

        goals: z
            .object({
                motivations: z
                    .array(
                        z.enum([
                            "career",
                            "research",
                            "passion",
                            "immigration",
                            "family",
                            "horizon",
                        ]),
                    )
                    .max(6)
                    .optional(),
                post_grad: z
                    .enum([
                        "return_home",
                        "stay_local",
                        "third_country",
                        "undecided",
                    ])
                    .optional(),
                phd_intent: z
                    .enum([
                        "definitely",
                        "likely",
                        "open",
                        "unlikely",
                        "no",
                    ])
                    .optional(),
                employability_vs_passion: z
                    .number()
                    .min(-2)
                    .max(2)
                    .optional(),
                urgency: z
                    .enum(["this_year", "next_year", "exploring"])
                    .optional(),
            })
            .partial()
            .optional(),

        field: z
            .object({
                primary: z.string().max(80).optional(),
                secondary: z.array(z.string().max(60)).max(5).optional(),
                avoid: z.array(z.string().max(60)).max(5).optional(),
                capstone_vs_thesis: z
                    .enum(["thesis", "capstone", "either", "unsure"])
                    .optional(),
                pace: z
                    .enum([
                        "intensive",
                        "balanced",
                        "extended",
                        "flexible",
                    ])
                    .optional(),
                teaching_likes: z.array(TeachingStyle).max(7).optional(),
                teaching_dislikes: z.array(TeachingStyle).max(7).optional(),
                assessment_likes: z
                    .array(AssessmentStyle)
                    .max(5)
                    .optional(),
                assessment_dislikes: z
                    .array(AssessmentStyle)
                    .max(5)
                    .optional(),
                class_size: z
                    .enum(["small", "medium", "large", "no_preference"])
                    .optional(),
                supervisor: z
                    .enum([
                        "hands_on",
                        "hands_off",
                        "balanced",
                        "no_preference",
                    ])
                    .optional(),
                peer_competitiveness: z
                    .number()
                    .min(-2)
                    .max(2)
                    .optional(),
            })
            .partial()
            .optional(),

        geography: z
            .object({
                target_countries: z.array(Country).max(8).optional(),
                excluded_countries: z
                    .array(ExcludedCountry)
                    .max(8)
                    .optional(),
                city_size: z
                    .enum([
                        "metro",
                        "large",
                        "mid",
                        "town",
                        "no_preference",
                    ])
                    .optional(),
                climate_likes: z.array(ClimateBucket).max(4).optional(),
                climate_dislikes: z.array(ClimateBucket).max(4).optional(),
                distance_from_home: z
                    .enum(["close", "moderate", "far", "no_preference"])
                    .optional(),
                safety_priority: z.number().min(0).max(4).optional(),
                food_pref: z
                    .enum(["asian_easy", "diverse", "any"])
                    .optional(),
                transit_pref: z
                    .enum([
                        "public_transit",
                        "walkable",
                        "car_friendly",
                        "any",
                    ])
                    .optional(),
                accommodation_pref: z
                    .enum([
                        "on_campus",
                        "homestay",
                        "private_rental",
                        "shared",
                        "any",
                    ])
                    .optional(),
                social_scene: z.number().min(-2).max(2).optional(),
            })
            .partial()
            .optional(),

        funding: z
            .object({
                annual_budget_aud: z.number().min(0).max(500000).optional(),
                flexibility: z
                    .enum([
                        "strict",
                        "stretchable_10",
                        "stretchable_25",
                        "flexible",
                    ])
                    .optional(),
                sources: z
                    .array(
                        z.enum([
                            "family",
                            "self_savings",
                            "loan",
                            "scholarship",
                            "employer",
                            "other",
                        ]),
                    )
                    .max(6)
                    .optional(),
                scholarship_priority: z
                    .number()
                    .min(0)
                    .max(2)
                    .optional(),
                work_intent: z
                    .enum([
                        "must_work",
                        "want_work",
                        "indifferent",
                        "no_work",
                    ])
                    .optional(),
                price_vs_rank: z.number().min(-2).max(2).optional(),
            })
            .partial()
            .optional(),

        credentials: z
            .object({
                gpa: z
                    .object({
                        value: z.number().min(0).max(110),
                        scale: GpaScale,
                        max: z.number().min(0).max(110).optional(),
                        self_confidence: z
                            .enum(["sure", "approximate", "unsure"])
                            .optional(),
                    })
                    .optional(),
                language: z
                    .object({
                        kind: z.enum([
                            "ielts",
                            "toefl",
                            "duolingo",
                            "pte",
                            "none",
                        ]),
                        overall: z.number().min(0).max(120).optional(),
                        listening: z.number().min(0).max(30).optional(),
                        reading: z.number().min(0).max(30).optional(),
                        writing: z.number().min(0).max(30).optional(),
                        speaking: z.number().min(0).max(30).optional(),
                        taken_at: z.string().max(20).optional(),
                        retake_plan: z
                            .enum(["yes", "maybe", "no"])
                            .optional(),
                        target_overall: z
                            .number()
                            .min(0)
                            .max(120)
                            .optional(),
                    })
                    .optional(),
                other_tests: z
                    .array(
                        z.object({
                            kind: z.enum([
                                "gre",
                                "gmat",
                                "sat",
                                "act",
                                "other",
                            ]),
                            status: z.enum(["have", "planned", "none"]),
                            score: z.number().min(0).max(2400).optional(),
                        }),
                    )
                    .max(4)
                    .optional(),
                work_years: z.number().min(0).max(40).optional(),
                research_experience: z
                    .enum([
                        "none",
                        "course",
                        "internship",
                        "publication",
                    ])
                    .optional(),
            })
            .partial()
            .optional(),

        signals: z
            .object({
                must_haves: z.array(z.string().max(80)).max(5).optional(),
                avoid_list: z.array(z.string().max(80)).max(5).optional(),
                liked_institutions: z
                    .array(z.string().max(80))
                    .max(8)
                    .optional(),
                disliked_institutions: z
                    .array(z.string().max(80))
                    .max(8)
                    .optional(),
                decisive_factors: z
                    .array(
                        z.enum([
                            "ranking",
                            "cost",
                            "employability",
                            "research",
                            "location",
                            "network",
                            "culture",
                            "safety",
                            "climate",
                            "language",
                        ]),
                    )
                    .max(5)
                    .optional(),
            })
            .partial()
            .optional(),

        personality_check: z
            .object({
                classroom_style: z.number().min(-2).max(2).optional(),
                risk_tolerance: z.number().min(-2).max(2).optional(),
                structure_pref: z.number().min(-2).max(2).optional(),
            })
            .partial()
            .optional(),

        // Free-form notes the LLM wants to surface in the final report but
        // can't fit anywhere structured. Soft cap at 5 short bullets.
        notes: z.array(z.string().max(140)).max(5).optional(),
    });

export type VoyageProfile = z.infer<typeof VoyageProfileSchema>;

// ---------- Per-turn LLM output ----------

const VoyageQuestionKind = z.enum([
    "choice", // single-select chips
    "multi", // multi-select chips
    "scale", // 5-point Likert
    "number", // numeric input
    "free", // open text
]);

const VoyageLandmark = z.enum([
    "island",
    "lighthouse",
    "continent",
    "reef",
    "port",
]);

export const VoyageQuestionSchema = z
    .object({
        topic: z.string().min(2).max(40),
        prompt: z.string().min(6).max(220),
        rationale: z.string().max(160).optional(),
        kind: VoyageQuestionKind,
        options: z
            .array(
                z.object({
                    label: z.string().min(1).max(28),
                    value: z.string().min(1).max(40),
                }),
            )
            .min(2)
            .max(6)
            .optional(),
        placeholder: z.string().max(40).optional(),
        landmark: VoyageLandmark.optional(),
    });

export type VoyageQuestion = z.infer<typeof VoyageQuestionSchema>;

export const VoyageTurnSchema = z
    .object({
        // One short sentence confirming what the user said last turn.
        // Models sometimes omit any of these fields when they have
        // nothing to say (e.g. first turn, or no profile changes); we
        // default rather than reject so a partial response still drives
        // a usable next turn.
        affirmation: z.string().max(120).optional().default(""),
        // Partial profile patch derived from the user's last answer +
        // upload summaries + prior turns. Empty object allowed.
        patch: VoyageProfileSchema.optional().default({}),
        // The next question to surface. Omit when done = true.
        question: VoyageQuestionSchema.optional(),
        done: z.boolean().optional().default(false),
        completeness: z.number().min(0).max(1).optional().default(0),
        done_reason: z.string().max(200).optional(),
    });

export type VoyageTurn = z.infer<typeof VoyageTurnSchema>;

// ---------- Prompt builders ----------

export interface VoyageUploadContext {
    readonly fileName: string;
    readonly doc_kind: string;
    readonly about_applicant: boolean;
    readonly title: string;
    readonly key_points: ReadonlyArray<string>;
    readonly applicant_summary?: string;
}

export interface VoyageHistoryTurn {
    readonly question: string;
    readonly answer: string;
    // Topic the previous question was tagged with; helps the model avoid
    // repeating the same axis.
    readonly topic?: string;
}

export interface VoyageAssessmentSummary {
    readonly big_five?: Record<string, number>;
    readonly interests?: Record<string, number>;
    readonly notes?: ReadonlyArray<string>;
}

export interface VoyagePromptInput {
    readonly locale: Locale;
    readonly profile: VoyageProfile;
    readonly uploads: ReadonlyArray<VoyageUploadContext>;
    readonly assessment?: VoyageAssessmentSummary;
    readonly history: ReadonlyArray<VoyageHistoryTurn>;
    // Runaway guard only. The model must NOT use this as a stop target;
    // see VOYAGE_SYSTEM_PROMPT and docs/voyage-profile-spec.md — the true
    // stop condition is completeness >= 0.9 with all six load-bearing
    // dimensions reaching their required positive/negative/confirmation
    // coverage. This number exists solely so a malfunctioning LLM cannot
    // loop forever.
    readonly maxTurns: number;
}

export const VOYAGE_SYSTEM_PROMPT = `You are a senior study-abroad advisor running a first-person "voyage" interview. The student moves through a sequence of waypoints; at each waypoint you ask ONE highly targeted detail question and absorb their answer into a structured profile.

The authoritative coverage spec lives in docs/voyage-profile-spec.md. Every dimension below must end up with BOTH a positive (most-wanted) and a negative (most-avoided) signal where applicable, PLUS confirmation of any fact already implied by uploaded documents. Do not stop until that coverage is reached.

Hard rules:
1. JSON output only, matching the VoyageTurnSchema exactly. No prose outside the JSON.
2. Locale: when input locale is "zh", "affirmation", "question.prompt", "question.rationale", "question.options[].label", "question.placeholder", "patch.*.reason", "patch.*.notes", and "done_reason" MUST be in Chinese. When "en", in English. Internal enum / code values stored in patch stay in English, BUT when those codes appear in user-facing text (question.prompt, affirmation, rationale, option labels) they MUST be translated to natural Chinese / English wording — NEVER paste raw codes like "employability", "ranking", "post_grad", "capstone_vs_thesis", "scholarship_priority", "AU", "UK" into Chinese prompts. Use natural phrases: location → 地理位置, employability → 就业前景, ranking → 学校排名, research → 科研机会, network → 校友与人脉, culture → 校园文化, AU → 澳大利亚, UK → 英国, US → 美国, etc.
3. Each turn ask exactly ONE question (or set done=true). The question must be:
   - About something not already known and decision-relevant for recommending programs.
   - Different from every prior question in the history (no rewording of the same axis).
   - Phrased naturally, conversational, 1-2 sentences, max 220 chars.
4. Distinguish FACT fields from PREFERENCE fields — they take DIFFERENT framings:
   FACT fields are objective values about the applicant. They include: credentials.gpa, credentials.language, credentials.other_tests, credentials.work_years, credentials.research_experience. For these you ONLY use:
     - CONFIRMATION framing when the value can be inferred from uploads or prior turns: "我看到你上传的成绩单 GPA 写的是 3.5/4.0，对吗？"
     - DIRECT FACTUAL framing when nothing has been inferred: "你目前的 GPA 大约是多少？是哪个分制？" / "你现在是否已经考过雅思或托福？分数是多少？"
   NEVER ask FACT fields with positive/negative preference wording. "最想要的 GPA 是多少" is WRONG — GPA is a fact, not a wish.
   PREFERENCE fields (everything in goals, field.*, geography.*, funding.*, signals.*, personality_check.*) take POSITIVE ("最想要…/最看重…") or NEGATIVE ("最不能接受…/最想避开…") framing. Alternate between positive and negative across consecutive preference turns.
5. Never assume or fabricate the user has answered something they have not. The CURRENT_PROFILE JSON in the user prompt is the ONLY source of truth for what is already known. Do NOT write affirmations like "我看到你在关键因素里列出了 X、Y、Z" unless those exact values appear in CURRENT_PROFILE or in the HISTORY block. If a field is empty in CURRENT_PROFILE, treat it as unknown and ASK, do not CONFIRM. If you want to acknowledge the previous answer, quote it from the most recent HISTORY answer verbatim.
6. Every turn must explicitly choose ONE framing from {POSITIVE, NEGATIVE, CONFIRMATION, FACTUAL} and must not repeat the same framing two turns in a row when alternatives are available.
6a. PREREQUISITES (applicant stage gating). Before asking any level-specific question, the profile.stage axis MUST be populated. Specifically:
    - stage.current_education AND stage.target_level MUST be established no later than turn 2 (unless already filled by uploads / assessment). If either is missing, the NEXT question MUST be about whichever is missing first. Use a single "choice" question covering: 高中在读 / 高中毕业 / 本科在读 / 本科毕业 / 硕士在读 / 硕士毕业 / 在职工作 / 其他.
    - Until current_education is known, do NOT ask about university GPA, work years, research experience, or graduate program specifics.
    - Until target_level is known, do NOT ask about thesis-vs-capstone, supervisor style, PhD intent, or program-pace questions tied to a particular level.
    - If a question would only apply at certain stages and the stage is incompatible (e.g. user says they are a 高中毕业生 with no university experience), do NOT ask university GPA / work years / research experience — instead set those fields' value to absent in the patch, append a notes entry "stage:<reason>", and move on.
6b. AFFIRMATION must reflect the user's ACTUAL last answer. Never reuse the same opener two turns in a row, and NEVER default to a stock "好的，明白". Pick the right pattern for the situation:    - If the user gave a concrete value: paraphrase it briefly ("收到，本科在读，目标是硕士。") .
    - If the user pushed back or flagged the question as wrong / inapplicable ("我没上过大学" / "这个问题对我不适用" / "你为什么问这个"): explicitly acknowledge the pushback, state how you are adjusting ("理解，那大学 GPA 这题不适用，我跳过，先确认你的高中学业情况。"), and pick a different topic next turn. Also reflect this in patch.notes.
    - If the user said "不知道" / "看情况" / "无所谓": acknowledge it as a valid neutral answer ("好的，那这条先记成无明显偏好。"), record a "neutral" or empty value in the patch with a note.
    - If the user gave a long elaboration: summarize the key takeaway in one short sentence to show you understood ("听上去你最在意的是学费控制在 30 万以内，研究氛围次之。") .
    - Affirmation must be 1 short sentence, max 60 Chinese characters / 80 English chars. No emoji. No filler like "非常感谢" / "棒极了".
6c. CONTINUITY / DRILL-DOWN. The conversation must feel connected, not a list of disconnected probes. After the user gives an answer, look at WHAT they actually said and decide whether the next turn should DRILL DOWN on it or pivot to a different dimension.
    - If the answer is a vague category label (e.g. "危险地区" / "天气好的地方" / "不太累的项目" / "前景好的专业" / "一线城市"), the NEXT turn MUST be a CONFIRMATION-style drill-down that proposes 3-5 concrete examples for the user to confirm or correct. Example: user says "排除危险地区" → next turn: "想跟你确认下范围。下面哪些是你说的危险地区？" with chips like "中东战乱国家 / 部分非洲国家 / 拉美高犯罪率城市 / 美国部分区域 / 其他（请补充）".
    - If the answer is concrete and decisive (e.g. "美国、英国、加拿大"), DO NOT drill down; pivot to a different dimension.
    - If the answer is ambiguous about magnitude (e.g. "我不太能接受高物价" → ask the price ceiling concretely), drill down with a NUMBER or SCALE turn.
    - When drilling down you MUST quote the user's exact phrase in the affirmation and explicitly say you are following up on it ("你刚说想排除「危险地区」，想跟你具体确认下…").
    - Continuity counter: do not drill down on the same vague phrase more than twice in a row — after two clarifications, accept what you have and move on.
7. Use "choice" when there is a clear short list of mutually exclusive options, "multi" when several may apply (e.g. teaching style likes), "scale" for -2..2 axes, "number" for budget / GPA / scores, "free" only when the answer is genuinely open. Provide 3-5 well-named options for choice/multi. Option labels MUST be natural language in the active locale (not enum codes). Open-universe topics (countries, cities, fields of study, specific programs / schools, hobbies) MUST include the 4-6 most common values as chips AND the user is expected to type additional values into a free-text supplement; do NOT pretend the chip list is exhaustive (e.g. for countries, listing only US/UK/AU/CA/NZ is fine because there is also a free-text supplement — do not phrase the question as "只能在以下选项里选").
8. Patch rules:
   - Only include fields you are confident about from the user's last answer or from upload context.
   - Never invent. If the user said "I don't know", leave the field empty and add a short note to "notes".
   - For target_countries / excluded_countries use ISO-2 codes when known (AU, UK, US, CA, NZ, IE, DE, NL, SG, HK, JP, FR, others as ISO-2). Direction values: "love" strongly positive, "like" positive, "neutral", "dislike" negative, "hate" strongly negative.
   - For -2..2 scales: -2 = strong left pole, 0 = neutral, +2 = strong right pole.
9. Cross-reference uploads BEFORE asking unrelated questions: if a resume or transcript stated a GPA, IELTS, work years or research experience, surface it via a confirmation question first. Do NOT silently copy upload values into the profile without confirming first. If NO upload mentions it, ask the FACTUAL form, not a confirmation form.
10. Stop conditions (set done=true when ANY holds, NOT based on turn count):
   - completeness >= 0.9 AND the six load-bearing dimensions (goals A, field B, geography C, funding D, credentials E, signals F) have each reached their "必填阈值" as defined in docs/voyage-profile-spec.md, i.e. positive + negative + confirmation cells all minimally populated.
   - The user explicitly says they want to stop or see results (quote the phrase in done_reason).
   - The user answered "I don't know" / "不知道" on two consecutive turns AND those gaps have been recorded into notes; further questioning would only frustrate them.
   There is NO hard ceiling on turns. maxTurns in the input is a runaway guard for malfunctioning runs only and is not a target. If turnsSoFar approaches maxTurns the system is in an error state.
11. landmark is purely cosmetic: choose "lighthouse" for CONFIRMATION or FACTUAL turns, "continent" for POSITIVE goals/geography, "island" for POSITIVE lifestyle / style / soft-preference, "reef" for NEGATIVE preferences / dealbreakers, "port" only when done.
12. Never emit emoji or markdown.

Question prioritization heuristic (apply in order, ask the highest-priority dimension that has an unfilled positive/negative/confirmation cell, per docs/voyage-profile-spec.md):
  a. E credentials — confirmation of any value extracted from uploads (GPA, IELTS, work years, research, other tests).
  b. A goals — urgency + post_grad.
  c. D funding — annual_budget_aud + flexibility.
  d. B field — primary + avoid (positive AND negative).
  e. F signals — decisive_factors (exactly 3 by spec).
  f. C geography — target_countries (with directions) + excluded_countries.
  g. B field — teaching_likes / teaching_dislikes (both poles required).
  h. E credentials — language (if missing or low confidence).
  i. F signals — must_haves + avoid_list (both poles required).
  j. C geography — city_size + climate + safety_priority.
  k. D funding — scholarship_priority + work_intent.
  l. B field — capstone_vs_thesis + supervisor + peer_competitiveness.
  m. E credentials — research_experience + other_tests.
  n. G personality_check.* — only if assessment summary is missing.
  o. F signals — liked_institutions / disliked_institutions.

Completeness scoring (the number you return in "completeness"):
  Compute weighted sum where each load-bearing dimension contributes 1 ONLY when its "必填阈值" from docs/voyage-profile-spec.md is satisfied. Weights:
    A goals 0.15, B field 0.20, C geography 0.15, D funding 0.15, E credentials 0.15, F signals 0.15, G personality 0.05.
  A dimension scores 0 (not 1) if any of its required cells (positive/negative/confirmation) is still blank.`;

export function buildVoyageUserPrompt(input: VoyagePromptInput): string {
    const lines: string[] = [];
    lines.push(`Locale: ${input.locale}`);
    lines.push(
        `runawayGuard_maxTurns: ${input.maxTurns} (NOT a target — stop when coverage is complete, not when turns are spent)`,
    );
    lines.push(`turnsSoFar: ${input.history.length}`);
    lines.push("");

    lines.push("CURRENT_PROFILE:");
    lines.push(JSON.stringify(input.profile, null, 2));
    lines.push("");

    if (input.uploads.length > 0) {
        lines.push("UPLOAD_CONTEXT:");
        for (const u of input.uploads) {
            lines.push(
                `- ${u.fileName} [${u.doc_kind}, about_applicant=${u.about_applicant}] ${u.title}`,
            );
            for (const k of u.key_points) {
                lines.push(`    * ${k}`);
            }
            if (u.applicant_summary) {
                lines.push(`    applicant_summary: ${u.applicant_summary}`);
            }
        }
        lines.push("");
    }

    if (input.assessment) {
        lines.push("ASSESSMENT_SUMMARY:");
        lines.push(JSON.stringify(input.assessment, null, 2));
        lines.push("");
    }

    if (input.history.length > 0) {
        lines.push("HISTORY (oldest first):");
        for (const h of input.history) {
            lines.push(
                `Q [${h.topic ?? "general"}]: ${h.question}\nA: ${h.answer}`,
            );
        }
        lines.push("");
    } else {
        lines.push("HISTORY: (empty — this is the first waypoint)");
        lines.push("");
    }

    lines.push(
        "Now produce the VoyageTurn JSON for the next waypoint. Reminders: (1) only ONE question; (2) never repeat a topic from history; (3) this turn's framing (POSITIVE / NEGATIVE / CONFIRMATION / FACTUAL) MUST differ from the previous turn's when alternatives are available; (4) FACT fields (GPA, language, work_years, research_experience, other_tests) are asked FACTUAL or CONFIRMATION — never with 'most wanted / 最想要' wording; (5) NEVER claim the user has already mentioned a value unless that value literally appears in CURRENT_PROFILE or in a HISTORY answer — if you have nothing to confirm, ASK instead of CONFIRM; (6) translate ALL enum codes (employability, ranking, location, AU, UK, post_grad, etc.) into natural locale text in question.prompt / affirmation / option labels — never paste raw English codes into Chinese sentences; (7) do NOT terminate based on turn count — only on coverage per docs/voyage-profile-spec.md; (8) ALWAYS include affirmation (empty string allowed on first turn) — pick a pattern that fits the user's actual last answer (concrete / pushback / don't-know / elaboration); never reuse 好的明白 / OK got it as a stock phrase; (9) check stage.current_education and stage.target_level FIRST — if either is missing, the next question MUST establish it; do not ask university GPA / work years / research experience / thesis-vs-capstone until stage is known and compatible.",
    );
    return lines.join("\n");
}
