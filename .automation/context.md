# FamilyRecipe — Project Context

FamilyRecipe is a monorepo for a greenfield tabular flexbox table layout for recipes.

## Status: IN PROGRESS
`packages/recipe-grid` represents a headless mobile-first, accessibility-first compiler and tree builder, a `-svelte` binding, `apps/site` render.

## Layout (monorepo = extract-later staging; packages self-contained)
- pnpm-workspace
- `packages/recipe-grid` — pure-TS core, ESM, `parse(md)->html_fagment`. NO framework. Eventual migration to separate repo.
- `packages/recipe-grid-svelte` — Svelte binding. Eventual migration to separate repo.
- `apps/site` — static consumer (`src/content/recipes/*.md`). `apps/editor` — later.