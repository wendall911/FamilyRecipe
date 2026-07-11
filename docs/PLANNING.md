# Goal
Goal is to make a family recipe book with a very simple table layout.

## Examples
 - https://cookbook.cstebbins.com/
   - Uses unknown/private svelte parser with a bunch of nested divs for layout
 - https://recipes.18sg.net/index.html
   - Uses https://github.com/mossblaser/recipe_grid parser
     - Python
     - Custom MD format called Recipe Grid 2
     - Uses some oldskool \<table\> layout renderer
     - Has good example parsing script for pulling from a committed directory:
       - https://github.com/18sg/recipes/blob/master/scripts/add_recent_recipes_to_readme.py
     - Documentation: https://mossblaser.github.io/recipe_grid/

Example:
```
Tiffin
======

A delicious, chocolatey treat.

    6 tsp of cocoa powder
    2 tbsp of golden syrup
    1/2 cup of butter
    1/2 cup of sugar
    16oz of digestives
    200g of chocolate
    
    cover(
        mix(
            heat until bubbling (cocoa powder, golden syrup, butter, sugar),
            crush(digestives)
        ),
        melt(chocolate)
    )
```
![Tiffin](https://github.com/mossblaser/recipe_grid/blob/main/docs/source/_static/tiffin_example.png)

 - https://github.com/TheSonOfThomp/recipe-parser
   - Unknown if the parser works correctly
   - Written in TypeScript
   - Uses a custom MD that doesn't look as flexible as Recipe Grid 2

Example:

```
Kraft Dinner
[1] Boil: 6 cups water
[2] Cook for 6 minutes: #1, macaroni
[3] Drain: #2
[4] Stir: 
    #3, 
    1/4 cup butter, 
    1/4 cup milk, 
    powdered cheese
```
![kd-example](https://github.com/TheSonOfThomp/recipe-parser/blob/master/kd-example.png)

## The Plan
  1. Utilize Recipe Grid 2 MD format, parsed by a TypeScript implementation of the
     recipe_grid parser (reference: https://github.com/mossblaser/recipe_grid). We
     replicate the *input* grammar only; the output is ours. Not a runtime Python
     dependency.
     1. The parser package (`@wendall911/recipe-grid`) is framework-agnostic: its only
        public surface is `parse(md) -> model`. The model (the nested recipe tree) is
        THE interface. No `render()` in this package -- rendering is a separate package.
  1. Svelte renderer package (`@wendall911/recipe-grid-svelte`) consumes the model and
     produces headless components (bits-ui-style): correct structure + accessibility +
     structural/layout CSS (flex that makes the recipe grid resolve), but NO theme.
     Consumers supply colors/fonts/spacing.
     1. Both `apps/site` and `apps/editor` consume this renderer, so they share one
        structure, one a11y implementation, one layout -- themed differently per app.
  1. `apps/site` (Svelte 5, runes) generates the static website.
     1. Recipe `.md` files are content, discovered at build time via `import.meta.glob`.
        One `.md` file per recipe; the model drives the shared renderer components.
     1. State management uses Svelte 5 runes (`$state`, `$derived`, `$effect`). Runes
        are the default in Svelte 5 -- no `svelte-options` opt-in, and no Redux.
     1. The index globs the recipe `.md` files and reads metadata (title, etc.) from
        each parsed model.
  1. Build via CI (Node). No Python step at runtime -- the parser is ported to TypeScript.

### Discover recipe content with `import.meta.glob`
Recipes are `.md` files under content, loaded as raw strings and fed to the parser:

```svelte
<script lang="ts">
    import { parse } from '@wendall911/recipe-grid';

    // eager: raw text of every recipe .md, keyed by path
    const files = import.meta.glob('/src/content/recipes/*.md', {
        eager: true,
        query: '?raw',
        import: 'default',
    }) as Record<string, string>;

    const recipes = Object.entries(files).map(([path, md]) => ({
        slug: path.split('/').pop()!.replace(/\.md$/, ''),
        model: parse(md),
    }));
</script>
```

### Render a parsed recipe (headless renderer + app theme)
The renderer package owns structure/a11y/layout; the app owns theme. The app passes the
model in and styles the emitted markup via the renderer's stable classes/`data-*` hooks:

```svelte
<!-- apps/site: consumes the shared headless renderer -->
<script lang="ts">
    import { parse } from '@wendall911/recipe-grid';
    import { Recipe } from '@wendall911/recipe-grid-svelte';
    import '@wendall911/recipe-grid-svelte/styles.css'; // structural CSS

    let { md }: { md: string } = $props();
    const model = $derived(parse(md));
</script>

<!-- Recipe renders structure + a11y + layout; app CSS themes it -->
<Recipe {model} />
```
## Card Layout
- https://flexboxfroggy.com/
- https://www.joshwcomeau.com/css/interactive-guide-to-flexbox/

---

# Architecture

## Two packages, two apps, one monorepo

The only novel piece is the parser; everything else is commodity. The parser is
framework-agnostic and publishable on its own; a separate Svelte package renders its
model. Both apps consume the renderer, so they share one structure/a11y/layout.

**Package naming:** local package names are `@wendall911/recipe-grid` and
`@wendall911/recipe-grid-svelte`. Directory names (`packages/parser`, `packages/svelte`)
are independent of published names. All four candidate npm names (scoped and unscoped)
were verified available (registry 404) as of this writing. Scoped chosen to pair the two
packages and match the account being secured; unscoped `recipe-grid` /
`recipe-grid-svelte` remain the recorded alternative. `workspace:*` needs no npm account;
publishing is a later, optional step.

1. **`packages/parser`** = `@wendall911/recipe-grid` -- pure TypeScript, no framework,
   no DOM. Ports the Recipe Grid 2 *input grammar* from recipe_grid (Python). Public
   surface: `parse(md: string) -> model`, plus the model types. The model is the nested
   recipe tree and is THE interface -- no rendering here. This is the publishable,
   framework-neutral "contribution for others" piece.

2. **`packages/svelte`** = `@wendall911/recipe-grid-svelte` -- depends on the parser via
   `workspace:*`. Consumes the model, emits headless Svelte components (bits-ui-style):
   semantic structure + accessibility + structural/layout CSS (the flex that makes the
   recipe grid resolve correctly). Ships laid-out but unthemed. No colors/fonts/spacing
   opinions -- exposes stable classes/`data-*` hooks for the consuming app to theme.

3. **`apps/site`** -- static consumer (adapter-static). Imports the parser + the Svelte
   renderer, renders committed `.md` files, adds theme CSS. During parser development
   this site *is* the visual feedback loop: edit parser -> HMR -> see rendered recipe in
   the browser. No separate throwaway harness.

4. **`apps/editor`** -- later. Not static. Consumes the same parser + renderer (live
   preview reuses them). Authenticated via an nginx gate at the reverse-proxy boundary
   -- a gate for a few trusted users, not a per-user account system. Save = write `.md`
   + git commit (git-as-database: repo is the store, commit is the transaction, rebuild
   on change).

Why two packages, not one: the parser stays pure and portable (any framework can consume
the model, or a future `-react` sibling can be added), while the Svelte package solves
structure + a11y + layout ONCE for both apps instead of each app rebuilding it.

## File layout

```
FamilyRecipe/
├── pnpm-workspace.yaml           # declares packages/* and apps/*
├── package.json                  # root, private
├── packages/
│   ├── parser/                   # @wendall911/recipe-grid (framework-agnostic core)
│   └── svelte/                   # @wendall911/recipe-grid-svelte (headless renderer)
└── apps/
    ├── site/                     # static consumer
    │   └── src/
    │       └── content/
    │           └── recipes/      # *.md, globbed by recipe/[slug]
    └── editor/                   # later: authenticated editor + live preview
```

Recipe `.md` files live under `apps/site/src/content/recipes/` because they are content.
The `recipe/[slug]` route loads the raw `.md`, parses it, and renders via the shared
Svelte renderer.

## Build sequence

Deliberately incremental; the browser is the source of truth at each step (sighted
workflow -- visual output in the browser is the primary check, tests are the regression
net).

1. Stand up `apps/site` (hand-built, no `sv create` scaffolding -- it gets overwritten
   every time anyway). Wire the `recipe/[slug]` route to load raw `.md`, parse it, and
   render via the Svelte renderer, starting from a few example recipes. The parser and
   renderer packages start as minimal stubs so the route always renders *something*.
2. Build the parser (`@wendall911/recipe-grid`) and renderer
   (`@wendall911/recipe-grid-svelte`) incrementally. The parser starts broken -- a
   minimal passthrough model -- and implements Grid 2 one capability at a time; the
   renderer grows to display each new model capability. Every step is verified visually
   in the browser. Iterate to 100% Grid 2 coverage, measured against mossblaser's
   canonical grammar/docs (the spec, not "looks done"). Tests catch regressions; the
   browser confirms correctness.
3. Build `apps/editor` (consumes the same two packages).
4. Circle back to finalize `apps/site`.

## Deployment (not finalized)

Self-hosted on the same server as wendall911-personal-website / roughness.technology is
the leading candidate. GitHub Pages was only ever a vehicle for GitHub-UI editing; that
premise is weak (GitHub can't preview Recipe Grid 2 md, and it adds an external
dependency), so the editor app supersedes it. Do not assume a target is confirmed.
