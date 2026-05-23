// Core package barrel. Subpackages export from their own folders.
// Consumers should import from specific paths (e.g. "@isp0526/core/rules")
// once subpath exports are configured; for now this barrel is the single entry.

export * from "./schemas/index.js";
export * from "./rules/weights.js";
export * from "./rules/score.js";
export * from "./rules/recommend.js";
export * from "./rules/thresholds.js";
export * from "./rules/bands.js";
export * from "./data/index.js";
export * from "./ai/index.js";
