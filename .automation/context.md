# FamilyRecipe — Project Context

FamilyRecipe is a monorepo for a greenfield tabular flexbox layout for recipes. This is a novel approach to recipes that uses the Cooking for Engineers approach of a single card for recipes, not a list of recipes followed by instructions. It is a novel project that should make no assumptions about how recipes work or what they mean.

The DAG is the only representation that can accurately describe the flexbox layout. The compiler produces a real DAG with edges that extend to other recipes. There is no tree, only a DAG.

Developed agile, not waterfall.

Licensed AGPL-3.0-or-later. Copyleft protects users' freedom; AGPL extends it to network/SaaS use.

```
FamilyRecipe/
├── pnpm-workspace.yaml
├── packages/
│   ├── recipe-grid/          # headless, mobile-first, a11y-first core. A compiler:
│   │                         #   markdown -> AST (PEG/Peggy) -> DAG model -> render structure.
│   │                         #   Format/DAG quick-ref: packages/recipe-grid/docs/RECIPE-FORMAT.md
│   │                         #   Exports two things: the render structure (DOM chunk + metadata)
│   │                         #   and the headless CSS. both core, not optional. Scaling and unit
│   │                         #   conversion are opt-in, separately-exported extensions. Model is internal.
│   │                         #   pure-TS, ESM, no framework.
│   └── recipe-grid-svelte/   # Svelte binding. wired and consumed by the site.
└── apps/
    ├── site/                 # static consumer; consumes via the binding, not the core directly
    └── editor/               # planned, not present: authenticated editor + live preview; validation lives here
```
