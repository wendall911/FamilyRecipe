# FamilyRecipe — Project Context

Minimal. Full design + resume anchor: `docs/PLANNING.md` ("Current State / Next Steps").

## What
Private family recipe book, flexbox table layout. Recipe Grid 2 markdown, one `.md` per recipe.

## Status: IN PROGRESS
`packages/recipe-grid` parser is functional, tests pass. NOT done: Stage-3 compiler (AST→model),
wiring `parse()` (currently a stub), `-svelte` binding, `apps/site` render.

## Layout (monorepo = extract-later staging; packages self-contained)
- `packages/recipe-grid` — pure-TS core, ESM, `parse(md)->model`. NO framework. Build `tsc`.
- `packages/recipe-grid-svelte` — Svelte binding.
- `apps/site` — static consumer (`src/content/recipes/*.md`). `apps/editor` — later.
- `recipe_grid/` — Python, reference ONLY (no runtime Python).

## Notes
- Generated parser `generated/grammar.generated.*` is committed. After any `grammar.peggy` edit,
  `pnpm generate` (maintainer-only). Tests: `node --test tests/*.test.ts`. Typecheck: `tsc --noEmit`.
  `pnpm add` is the user's action.
- Some divergences from Grid 2 exist; the existing recipes still parse correctly. See PLANNING.
- JS string/number ≠ Python — don't port operations 1:1; probe the parser as the oracle.
