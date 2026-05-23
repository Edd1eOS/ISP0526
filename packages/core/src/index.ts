// Core package barrel. Subpackages export from their own folders.
// Consumers should import from specific paths (e.g. "@isp0526/core/rules")
// once subpath exports are configured; for now this barrel is the single entry.

export * from "./schemas/index";
export * from "./rules/weights";
export * from "./rules/score";
export * from "./rules/recommend";
export * from "./rules/thresholds";
export * from "./rules/bands";
export * from "./data/index";
export * from "./ai/index";
export * from "./ai/templates/narrative-template";
export * from "./reports/code";
