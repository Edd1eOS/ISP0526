// AI layer barrel.
// See docs/spec.md section 5.6 and .github/instructions/ai-layer.instructions.md.
// Every LLM call MUST: parse -> validate via Zod -> post-filter (drop fields
// lacking source_id) -> return. No inline multi-line prompts in business code.

export * from "./result";
export * from "./config";
export * from "./post-filter";
export * from "./prompts/recommendation-narrative";
export * from "./prompts/recommendation-narrative-batch";
export * from "./adapters/narrative";
export * from "./adapters/narrative-batch";
export * from "./prompts/intake-extraction";
export * from "./adapters/intake-extraction";
export * from "./prompts/upload-summary";
export * from "./adapters/upload-summary";
export * from "./prompts/voyage-question";
export * from "./adapters/voyage-question";
export {
    ChatCitationSchema,
    ReportChatReplySchema,
    type ChatCitation,
    type ReportChatReply,
    type ReportChatContextProgram,
    type ReportChatVisaContext,
    type ReportChatPromptInput,
} from "./prompts/report-chat";
export {
    generateReportChatReply,
    type ReportChatAdapterInput,
} from "./adapters/report-chat";
export {
    PlanChecklistSchema,
    ChecklistItemSchema,
    ChecklistCategorySchema,
    type PlanChecklist,
    type ChecklistItem,
    type ChecklistCategory,
    type ChecklistContextProgram,
    type PlanChecklistPromptInput,
} from "./prompts/plan-checklist";
export {
    generatePlanChecklist,
    type PlanChecklistAdapterInput,
} from "./adapters/plan-checklist";
