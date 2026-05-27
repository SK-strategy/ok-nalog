// Re-export from shared so consumers that already imported `categoryStyle`
// from this slice keep working, but cross-entity callers (order, claim-order)
// reach for the shared version instead — avoids fsd/forbidden-imports.
export { categoryStyle } from '~/shared/lib/category-palette'
