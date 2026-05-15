# FamilyRecipe — Project Context

## What This Is
A private family recipe book with a table layout, for personal family use. Not a public-facing product.

## Tech Stack
- SvelteKit + TypeScript + Tailwind CSS
- pnpm
- Python (recipe_grid parser, used as reference for TypeScript implementation)
- GitHub Actions (runs both Python and Node build steps)

## Architecture
Recipes are written in Recipe Grid 2 markdown format (one `.md` file per recipe). The design intent is:
1. A TypeScript implementation of the recipe_grid parser (reference: https://github.com/mossblaser/recipe_grid) handles parsing
2. Parsed output feeds into Svelte components that render a table layout
3. SvelteKit generates a static site; GitHub Actions rebuilds and deploys when recipe files are added or updated
4. Recipes are committed as `.md` files — the GitHub UI is an acceptable editing interface for adding recipes

See `docs/PLANNING.md` for full design notes, parser references, and component strategy.

## Key Design Decisions
- Recipe Grid 2 MD format is the canonical recipe source format
- Parser is a TypeScript implementation based on recipe_grid (Python), not a direct Python dependency at runtime
- One Svelte component per rendered recipe, auto-discovered via `import.meta.glob`
- State management uses Svelte Runes (see `docs/PLANNING.md` for context notes)

## Branch Convention
- `main` is the only active branch
- Release tagging is possible but not required — `main`/HEAD may serve as the release

## Deployment Model
- Not finalized. Candidates: personal server (same model as wendall911-personal-website) or GitHub Pages
- If GitHub Pages: may require moving roughness.technology to a different host to free the one free Pages slot
- Do not assume a deployment target is confirmed; check README or ask before any release-related work

## Status
Future project — not yet started. `docs/PLANNING.md` is the current source of design intent.
