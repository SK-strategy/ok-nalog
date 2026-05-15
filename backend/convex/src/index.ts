// Public API of @fedor/convex — re-exports the codegen output so consumers
// import a single, stable path. Regenerate `convex/_generated/` with
// `pnpm -F @fedor/convex codegen` when the schema or functions change.
export { api } from '../convex/_generated/api'
export type { Doc, Id } from '../convex/_generated/dataModel'
