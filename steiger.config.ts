import fsd from '@feature-sliced/steiger-plugin'
import { defineConfig } from 'steiger'

// Steiger enforces Feature-Sliced Design (FSD) on apps/web/src.
// Layer order (top → bottom): app → views → widgets → features → entities → shared.
// Higher layers may import lower; lateral imports (same layer, different
// slice) are forbidden. Slice public APIs live at `<slice>/index.ts`.
//
// Full rule list: https://github.com/feature-sliced/steiger
// Project conventions: AGENTS.md
export default defineConfig([...fsd.configs.recommended])
