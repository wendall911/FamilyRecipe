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
   grammar* from recipe_grid (Python), AND owns everything
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

## Data model

The object model lives in `packages/recipe-grid/src/model.ts` and is the interface the
renderer consumes. It began as a superset of the Recipe Grid 2 semantic model (mossblaser's
`recipe_grid`) and has since diverged into its own fork -- faithful where the two agree,
deliberately different where this project's goals differ. A clean-room reimplementation of
the *input grammar* and model, not a source port. Recipe Grid 2 is a reference, not a
canonical source.

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

## Deployment (not finalized)

Self-hosted on the same server as wendall911-personal-website / roughness.technology is
the leading candidate. GitHub Pages was only ever a vehicle for GitHub-UI editing; that
premise is weak (GitHub can't preview Recipe Grid 2 md, and it adds an external
dependency), so the editor app supersedes it. Do not assume a target is confirmed.

---

## Next steps

The `-svelte` component shapes are set. Testing them is next.

The plan is jsdom + binding tests in `recipe-grid-svelte`, one part component at a
time, with the harness modeled on the bits-ui test setup.

A we will levarage a fixture in `recipe-grid-svelte` that is a real md file with one example of each node type in the spec -- is the canonical input every component test renders from.

Each test renders a part from the fixture and checks its DOM shape and content,
covering the bindings, not only static markup.

## Known gaps / deferred (do not treat as done)

- **Unit conversions:** deferred; seams marked `[DEFERRED: units]`.
- **Scaling runtime function** (`scale(node, factor)`): model preserves scalable values; the
  runtime scaler is not written (a renderer/binding concern).
- **Minimal DAG/structure tests:** verification is by probing the pipeline. AST tests exist.
- **`offset: null`** on substrings coalesced inside `{...}` (cosmetic).

## Working notes for a resuming session

- **Verify by reading the actual output and matching shapes -- do NOT do math against data.**
  Counting nodes and comparing to an expected number is how bugs slip through. The `.md` is
  the source of truth for what ingredients exist; the DAG output either looks like the right
  shape or it does not. Probe the pipeline (it is the oracle); read the structures. The Grid 2
  table got us TO our shape and is largely spent now -- we render our own DAG; compare against
  our own dumps, not Grid 2's `<table>`.
- **Probe scripts live in `packages/recipe-grid/debug/`** (see its README). Read-only dumps of
  each stage (AST, DAG, walk-structure, built elements, full render). Run e.g.
  `node debug/probe-compile.mjs`. Useful only if a session re-enters AST/DAG internals; the
  likelier next work (real recipes + metadata) won't need them.
- The Peggy string model is NOT the Python one. Build AST from raw `$()`-captured text; do not
  translate Python `str`-class ops 1:1. Numbers: JS has one `number`; exact fractions use
  `fraction.js`.
- The generated parser (`generated/grammar.generated.{js,d.ts}`) is committed and shipped.
  `generate` is a maintainer-only step; after any `grammar.peggy` change it must be
  regenerated. Consumers/CI never run generate.
