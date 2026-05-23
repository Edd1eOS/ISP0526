// AI layer barrel.
// See docs/spec.md section 5.6 and .github/instructions/ai-layer.instructions.md.
// Every LLM call MUST: parse -> validate via Zod -> post-filter (drop fields
// lacking source_id) -> return. No inline multi-line prompts in business code.

export * from "./result.js";
export * from "./config.js";
export * from "./post-filter.js";
export * from "./prompts/recommendation-narrative.js";
export * from "./adapters/narrative.js";
