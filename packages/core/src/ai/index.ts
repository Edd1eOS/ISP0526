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
