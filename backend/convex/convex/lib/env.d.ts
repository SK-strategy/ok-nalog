// Convex injects `process.env` at runtime (values set via `npx convex env set`).
// The Convex runtime is not Node, so we declare only this minimal surface
// instead of pulling in all of @types/node.
declare const process: { env: Record<string, string | undefined> }
