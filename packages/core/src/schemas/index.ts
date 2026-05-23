// Zod schemas shared across the app.
// Each schema is the single source of truth for its shape; TS types are
// derived via z.infer in the owning file and re-exported here.

export * from "./ids";
export * from "./source";
export * from "./institution";
export * from "./student-profile";
export * from "./scoring";

