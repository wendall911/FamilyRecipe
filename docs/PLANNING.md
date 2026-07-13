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
     1. **Parser engine: Peggy.** The parser is built on Peggy (the maintained
        PEG.js successor), not a hand-written parser. recipe_grid's own parser is
        a PEG: `grammar.peg` (pure grammar) consumed by `peggie` (Python), with
        semantics in a separate `ast.py` transformer. We mirror that split in
        TypeScript:
        - Port `grammar.peg` -> a Peggy grammar (same ~20 rules; peggie's
          `r"..."` regex-terminal syntax becomes Peggy regex/char-class rules).
        - Port `ast.py`'s `RecipeTransformer` -> a transformer producing
          `model.ts`.
        - Indentation-sensitivity (peggie is indentation-aware) is expressed in
          Peggy via semantic predicates over an indent-stack held in the
          grammar's initializer block -- the standard PEG approach (used by
          CoffeeScript/Jade grammars), not a special library. INDENT/DEDENT
          logic that a Python lexer emits as tokens is done inline via predicates
          here.

        **Three-stage pipeline** (mirrors recipe_grid; kept distinct for
        maintainability and to keep the [EXT] superset extensible per-stage):
        1. **Grammar (Peggy)** -- port of `grammar.peg`. Peggy parses source
           into a raw parse tree. Syntax only.
        2. **AST** -- port of `parser/ast.py`. A transformer turns the raw parse
           tree into a syntactic AST (`Recipe/Stmt/Expr/Step/Reference/Quantity/
           Proportion/String/...`). This AST is the stable seam between parser
           and compiler.
        3. **Compiler -> model** -- port of `compiler.py`. Resolves names
           (Reference vs Ingredient via a cross-statement name table), wraps
           `SubRecipe` outputs, inlines single-use sub-recipes, and chains
           `follows`. Output is the `model.ts` DAG.

        The AST stage is load-bearing, not ceremony: name resolution needs the
        whole parsed document before it can decide Reference-vs-Ingredient, so it
        cannot be folded into per-rule grammar actions. Collapsing the stages
        couples the compiler to Peggy's tree shape and makes future Grid-2-plus
        extensions harder to reason about; new syntax lands in stage 1+2, new
        semantics in stage 3, with the AST as the contract between them.

        Reinventing a PEG engine is out of scope; Peggy is the engine, the
        grammar and transformer are ours. References:
        - Peggy docs: https://peggyjs.org/documentation.html
        - Peggy repo: https://github.com/peggyjs/peggy
        - Peggy.js tutorial (Tomassetti): https://tomassetti.me/a-peggy-js-tutorial/
        - Adams, "Principled parsing for indentation-sensitive languages":
          https://www.researchgate.net/publication/268466333
        - Indentation-in-PEG precedent (CoffeeScript/Jade, PEG.js group):
          https://groups.google.com/g/pegjs/c/Votinwk5g7c
  1. The framework-neutral grid -- layout, base CSS, ARIA/semantic structure -- lives in
     the core `@wendall911/recipe-grid` alongside the parser. The Svelte binding
     (`@wendall911/recipe-grid-svelte`) is a thin adapter that renders that structure as
     headless Svelte components (bits-ui-style, `data-recipe-grid-*`), NO theme. Consumers
     supply colors/fonts/spacing.
     1. Both `apps/site` and `apps/editor` consume the Svelte binding; a future `-react`
        binding reuses the same core layout/a11y. One structure, one a11y implementation,
        one layout -- themed differently per app.
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

### Render a parsed recipe (Svelte binding + app theme)
The core owns structure/a11y/layout; the Svelte binding renders it; the app owns theme.
The app goes through the binding only -- it never imports the core parser directly. It
loads the model via the binding's `loadRecipe`, and themes the emitted markup via the
core's stable `data-recipe-grid-*` hooks:

```svelte
<!-- apps/site: consumes the Svelte binding only -->
<script lang="ts">
    import { Recipe, loadRecipe } from '@wendall911/recipe-grid-svelte';
    import '@wendall911/recipe-grid-svelte/styles.css'; // structural CSS (from the core)

    let { md }: { md: string } = $props();
    const model = $derived(loadRecipe(md));
</script>

<!-- The binding renders the core's structure + a11y + layout; app CSS themes it -->
<Recipe.Root {model}>
    <Recipe.Title />
    <Recipe.Grid />
</Recipe.Root>
```
## Card Layout
- https://flexboxfroggy.com/
- https://www.joshwcomeau.com/css/interactive-guide-to-flexbox/

---

# Architecture

## Two packages, two apps, one monorepo

The novel piece is the core: parser + framework-neutral grid (layout, base CSS, ARIA),
publishable on its own. A separate Svelte binding renders that core's structure for Svelte
consumers; a future `-react` binding would do the same. Structure/a11y/layout live once in
the core, so all bindings and both apps share one implementation.

**Package naming:** local package names are `@wendall911/recipe-grid` and
`@wendall911/recipe-grid-svelte`. Directory names match the package names
(`packages/recipe-grid`, `packages/recipe-grid-svelte`). All four candidate npm names (scoped and unscoped)
were verified available (registry 404) as of this writing. Scoped chosen to pair the two
packages and match the account being secured; unscoped `recipe-grid` /
`recipe-grid-svelte` remain the recorded alternative. `workspace:*` needs no npm account;
publishing is a later, optional step.

1. **`packages/recipe-grid`** = `@wendall911/recipe-grid` -- the framework-agnostic
   **core**. Pure TypeScript, no framework binding. Ports the Recipe Grid 2 *input
   grammar* from recipe_grid (Python) via `parse(md) -> model`, AND owns everything
   framework-neutral about presenting a recipe: the grid **layout**, the structural
   **base CSS** (the flex that makes the recipe grid resolve), and the **ARIA**/semantic
   structure. It exposes the renderable grid structure + stable `data-*` hooks; framework
   bindings render it, they do not re-implement it. This is the publishable,
   framework-neutral piece -- and the reason a `-react` sibling would be thin.

2. **`packages/recipe-grid-svelte`** = `@wendall911/recipe-grid-svelte` -- the **Svelte
   binding**. Depends on the core via `workspace:*`. It is a thin adapter that renders the
   core's grid structure as Svelte components (bits-ui-style, `data-recipe-grid-*`) and
   exposes a Svelte-idiomatic API (`Recipe.*`, `loadRecipe`). It does **not** own layout,
   base CSS, or ARIA -- those live in the core so every binding (Svelte, a future React,
   etc.) shares one implementation instead of re-doing it. Ships unthemed; the app themes
   via the core's stable hooks.

3. **`apps/site`** -- static consumer (adapter-static). Imports the parser + the Svelte
   renderer, renders committed `.md` files, adds theme CSS. During parser development
   this site *is* the visual feedback loop: edit parser -> HMR -> see rendered recipe in
   the browser. No separate throwaway harness.

4. **`apps/editor`** -- later. Not static. Consumes the same parser + renderer (live
   preview reuses them). Authenticated via an nginx gate at the reverse-proxy boundary
   -- a gate for a few trusted users, not a per-user account system. Save = write `.md`
   + git commit (git-as-database: repo is the store, commit is the transaction, rebuild
   on change).

Why two packages, not one: the core solves parsing AND structure + a11y + layout ONCE, in
a framework-neutral form. A framework binding (`-svelte` now, a future `-react`) is then a
thin adapter over that shared core -- so adding a framework does not re-implement layout,
base CSS, or ARIA, and both apps share one implementation.

## File layout

```
FamilyRecipe/
├── pnpm-workspace.yaml           # declares packages/* and apps/*
├── package.json                  # root, private
├── packages/
│   ├── recipe-grid/              # @wendall911/recipe-grid (core: parser + layout/CSS/ARIA)
│   └── recipe-grid-svelte/       # @wendall911/recipe-grid-svelte (Svelte binding)
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

## Data model

The object model lives in `packages/recipe-grid/src/model.ts` and is the interface the
renderer consumes. It is a **superset of the Recipe Grid 2 semantic model** (mossblaser's
`recipe_grid`, ported from `recipe_grid/recipe.py`). Recipe Grid 2 is checked out under
`FamilyRecipe/recipe_grid/` as a comprehension reference (AGPL-compatible; clean-room
reimplementation of the *input grammar* and model, not a source port).

Provenance is tagged per declaration in the model file:

- **[G2]** -- faithful to Recipe Grid 2 (documented reference for "what is canon").
- **[EXT]** -- FamilyRecipe extension, not present in Recipe Grid 2.

### Recipe Grid 2 model (a DAG)

A recipe is a **Directed Acyclic Graph** (not merely a tree): later trees may reference the
outputs of earlier trees. Node and value types, carried verbatim into our model:

- **`Ingredient`** -- leaf: `description` (scale-aware string) + optional `quantity`.
- **`Step`** -- `description` + `inputs` (the children being combined). The combiner.
- **`SubRecipe`** -- a named logical division: `subTree`, one or more `outputNames`,
  `showOutputNames`. A SubRecipe with more than one output must be a tree root.
- **`Reference`** -- an **intra-document** reference to a named output of a `SubRecipe`
  (Grid 2's own reuse mechanism): `subRecipe`, `outputIndex`, `amount`.
- **`Quantity`** -- absolute amount: `kind: 'quantity'`, `value`, `unit`,
  `valueUnitSpacing`, `preposition`. **Unit conversion is DEFERRED** (marked in code with
  `[DEFERRED: units]`); `units.ts` holds unit *names* only. Scaling is a runtime concern,
  not baked into the value.
- **`Remainder`** [DIVERGENCE from Grid 2] -- replaces Grid 2's numeric `Proportion`.
  Only the "use the rest" case: `kind: 'remainder'`, `wording`, `preposition`. Grid 2's
  numeric proportions (`%`, `*`, fractional value) are **dropped** -- the published Grid 2
  corpus never uses them and real recipes only ever say "use the rest". `Amount =
  Quantity | Remainder`, both discriminated by `kind`.
- **`ScaledValueString`** -- a string as an ordered list of `Substring` (literal text) and
  `InterpolatedValue` (embedded scalable number) parts. In the `.md`, `{N}` braces mark a
  number as scalable (Grid 2's ScaledValueExpression); the number becomes an
  `InterpolatedValue`, surrounding text stays literal, braces are stripped. The grammar
  only *marks* what is scalable; the runtime does the actual scaling. Every description /
  step name / output name is this type.
- **`Recipe`** -- container: `recipeTrees` + `follows` (multi-section chain; references
  may resolve backward across it).

### Scaling [EXT / DIVERGENCE from Grid 2]

Grid 2 inferred a serving count from the title ("Spam for 2") and pre-generated static
`/serves1/`, `/serves2/`, ... files. We reject both. Scaling is declared explicitly in the
recipe's **YAML frontmatter** and applied at **runtime** (no static-file generation):

- `RecipeScaling` (single source of truth in `model.ts`, aliased by `markdown.ts`'s
  `RecipeMeta`): `scalingType: 'servings' | 'fixed'` (required), `base?: RecipeNumber`
  (default 1). `Recipe` includes it via `& RecipeScaling`.
- Absent frontmatter -> `{ scalingType: 'fixed', base: 1 }`, so bare Grid 2 recipes remain
  valid. `'servings'` scales at ½x / 1x / 2x of `base` (per-recipe, not uniform); `'fixed'`
  does not scale. No free-form multiplier, no unit conversion (both out of scope).
- Frontmatter is parsed by `markdown.ts` using the `yaml` package (eemeli/yaml), split off
  before `marked` lexes the body (marked does not handle frontmatter).

### FamilyRecipe extensions [EXT]

- **`RecipeReference`** -- a **cross-file** reference to another recipe by identity
  (`targetSlug`), for base recipes (e.g. a roux) shared across many recipe files. Grid 2's
  `Reference` targets a SubRecipe object *within* a document; this targets another recipe
  file. A reference is a pointer, not a guarantee: the target may not exist (a dangling
  reference is still valid, like a hyperlink to a 404). Resolution/lookup is a
  site/index-layer concern, not the model's.
- **`IngredientIdentity`** -- optional structured/canonical ingredient identity
  (`canonicalName`, room to grow toward schema.org / allergens / categories). Grid 2's
  `Ingredient` carries only a description string.

### Numeric values and constraints

- Grid 2 uses exact fractions (¼ tsp stays ¼). JS `number` cannot represent these, so
  exact values are held as a `Fraction` (`{ numerator, denominator }`) and arithmetic /
  formatting is delegated to a dedicated value handler (a fraction library).
- TypeScript here is **decorative** -- erased at compile time, enforcing nothing at
  runtime. Grid 2's structural invariants (a Reference may only target a prior SubRecipe
  root; multi-output SubRecipes may only be tree roots) are **not** enforced. Decision: a
  bad reference is just a bad reference (like a hyperlink to a 404); invalid recipes are
  allowed to break. Validation is **deferred to the future editor**, not the parser. The
  two compile-time errors that *do* surface (`NameRedefinedError`,
  `ProportionGivenForIngredientError`) are kept because they invalidate a recipe an editor
  will want to catch.

- **AST stage is not a separate transformer file.** PLANNING originally described porting
  `ast.py`'s transformer into its own pass. In practice the Peggy grammar's semantic
  actions emit AST nodes **directly** (`ast.ts` is the type seam). Stages 1+2 are fused in
  the grammar; stage 3 (compiler) is still separate. This is a deliberate divergence, not a
  gap.

### Layout

The rendered layout is **flexbox**, not `<table>` and not CSS grid. It is a defined
structure for content: large content simply makes a cell/column taller. Recipes are
shallow by design -- where a step needs its own breakdown it becomes a separate
recipe-grid (a sub-recipe, typically a link-out rather than an embed), which is what
`RecipeReference` models.

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

---

# Current State / Next Steps

Resume anchor. Everything below reflects the actual, verified state of
`packages/recipe-grid` (the only package with real work). Sections above are the
architectural charter; where they conflict with this section, this section wins.

## Done and verified (tests + typecheck pass)

- **Grammar -> AST (stages 1+2, fused in Peggy actions):** actioned and probed for every
  construct the two real recipes + the contrived kitchen-sink fixture use:
  - ingredient quantities (integer / decimal / exact fraction via `fraction.js`), unit-less
    counts, known units (`units.ts` names, substituted for `@KNOWN_UNITS@` at generate time),
    prepositions ("of the").
  - named sub-recipes (`:=`) and multi-output (`=`); references resolve by name.
  - **Remainder** ("Remaining X" -> `amount.kind: 'remainder'`, case-insensitive, wording
    preserved as authored).
  - **Quoted strings** (`"..."` / `'...'`) as a literal-name escape hatch: body captured raw
    via `$()`, escapes NOT resolved, punctuation like `( , %` preserved. Bad input breaks.
  - **`{N}` interpolation** -> `InterpolatedValue` embedded in the name (scalable number,
    literal surrounding text, braces stripped). `explicit_quantity` was removed (with orphans
    `freeform_unit`, `static_string`) -- `{...}` is never a reference amount.
- **`model.ts`:** the `[G2]`/`[EXT]` superset types. `RecipeScaling` is the single source of
  truth for scaling metadata (`markdown.ts`'s `RecipeMeta` aliases it).
- **`recipe-model.ts`:** the behaviour bridge (free functions over the decorative model
  types): `compileString`, `svsNormalize/Equal/ToString`, `normaliseOutputName`,
  `quantitiesHaveEqualValue` (`[DEFERRED: units]` -- same-unit only), `amountIsFullQuantityOf`,
  `nodesEqual` (structural), `substitute` (immutable, per-node), `inferOutputName/Quantity`.
  This is what the compiler will consume.
- **`markdown.ts`:** `extractRecipe(md) -> { title, blocks, meta }` -- strips YAML frontmatter
  (via `yaml`), parses scaling meta with defaults, lexes the body with `marked`.
- **Fixtures + committed tests:** `tiffin.md` (fixed), `egg-fried-rice.md` (servings, base 2),
  `acid-phosphate.md` (servings; exercises remainder + partial-quantity + null-amount = "all
  of it"), `kitchen-sink.md` (contrived; quoted strings + `{N}` interpolation). Note fixtures
  live in `packages/recipe-grid/tests/fixtures/` AND `apps/site/src/content/recipes/`; the
  user copies to the site copy manually.

## Immediate next steps (in order)

1. **Stage 3 -- the compiler** (`compiler.py` port -> a `compile(sources) -> Recipe[]`
   function over `model.ts`, using the `recipe-model.ts` bridge). It resolves
   Reference-vs-Ingredient via a cross-statement name table, wraps `SubRecipe` outputs,
   inlines single-use sub-recipes, and chains `follows`. The bridge is ready; the compiler is
   NOT written. Canonical references are checked out at `FamilyRecipe/recipe_grid/`
   (`compiler.py`, `recipe.py`).
2. **Wire `parse()`** in `index.ts` to return the real model. It currently returns a
   PLACEHOLDER: `{ title, source: JSON.stringify(trees) }`. The public surface is `parse(md)
   -> model`.
3. **`-svelte` binding + `apps/site` render path** -- consume the model, render the flex grid.

## Known gaps / deferred (do not treat as done)

- **Unit conversions:** deferred; seams marked `[DEFERRED: units]`.
- **`offset: null`** on substrings coalesced inside `{...}` (cosmetic; interior offsets lost).
- **Scaling runtime function** (`scale(node, factor)`): the model preserves scalable values;
  the actual runtime scaler is not written (a renderer/binding concern).

## Working notes for a resuming session

- The Peggy string model is NOT the Python one. Build AST from raw `$()`-captured text; do not
  translate Python `str`-class operations 1:1. Numbers: JS has one `number` primitive; exact
  fractions use `fraction.js`. Probe the parser empirically (it is the oracle) rather than
  reasoning about output.
- The generated parser (`generated/grammar.generated.{js,d.ts}`) is committed and shipped.
  `generate` is a maintainer-only step; after any `grammar.peggy` change it must be
  regenerated. Consumers/CI never run generate.
- Tests: `node --test tests/*.test.ts`. Typecheck: `tsc --noEmit`.
