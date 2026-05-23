// Core package barrel. Subpackages export from their own folders.
// Consumers should import from specific paths (e.g. "@isp0526/core/rules")
// once subpath exports are configured; for now this barrel is the single entry.

export * from "./rules/weights.js";
