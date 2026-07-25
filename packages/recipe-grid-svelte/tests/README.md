# tests

jsdom + testing-library. Verifies the wrapper wraps a recipe into a consumable card, not that recipe-grid is correct (that is recipe-grid's job).

## Run

`pnpm test` (from this package)

## Layout

- `fixtures/` - recipe `.md` inputs. Data only, no logic.
- `util/`     - test helpers (e.g. `loadFixture`).
- `recipe/`   - jsdom tests plus their `.svelte` harnesses.
- `other/`    - non-target package checks (exports resolve, analysis dump, etc.).

## What each file is

- `fixtures/turkish-pizza.md`       - real recipe exercising all three sections.
- `util/loadFixture.ts`             - reads a fixture by filename.
- `recipe/recipe-root.test.ts`      - Root: no wrapper when `as` nullish; wraps + passes props when set.
- `recipe/recipe-title.test.ts`     - Title: h1 by default; raw text when `as` empty.
- `recipe/recipe-description.test.ts` - Description: p by default; raw text when `as` empty.
- `recipe/recipe-grid.test.ts`      - Grid: faithful wrap of chosen top-level and nested nodes.
- `recipe/*Harness.svelte`          - one small mount harness per component composition.
- `other/smoke.test.ts`             - public surface resolves.

---

Code is the oracle; tests keep us honest. Keep files small; split when unreadable.

---
