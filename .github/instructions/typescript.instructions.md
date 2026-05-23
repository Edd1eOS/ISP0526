---
applyTo: "**/*.{ts,tsx}"
---

# TypeScript conventions

- Strict mode. `noImplicitAny`, `strictNullChecks`, `exactOptionalPropertyTypes` all on.
- Prefer `type` for object shapes; `interface` only when extending a class or augmenting a module.
- Discriminated unions over enums.
- Branded types for IDs: `type UserId = string & { readonly __brand: 'UserId' }`.
- No `Function`, `Object`, or `{}` as types. Be specific.
- Imports: absolute paths via tsconfig `paths` (`@/features/...`, `@core/...`). No deep relatives `../../../`.
- File names: `kebab-case.ts`. React components: `PascalCase.tsx`.
- One default export per file is fine for React components only; otherwise prefer named exports.
- Avoid barrel `index.ts` re-exports that span more than one directory.
- Async: never mix `.then()` chains with `await` in the same scope.
- Errors: define a `Result<T, E>` type or use thrown errors consistently within a module, never mix.
