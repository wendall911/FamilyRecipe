## Project identity & naming

**What this is.** **FamilyRecipe** is just a monorepo for the greenfield project. A human reviewable browser consumable (`apps/site`) that serves as way for verification of the fully rendered output: ingredients on the left flowing into steps, the "Cooking for Engineers" layout, from a human-readable markdown format that *is* the data. **`recipe-grid-svelte`** is the Svelte 5 binding used by `apps-site`, and is a thin wrapper on **`recipe-grid`** headless component API.

A recipe is a graph, and the markdown is that graph written down. A name declared once and used again is one node reached twice, not two copies -- that shared node is the whole distinction between this and a list of ingredients followed by a list of steps. Every card is one such graph, complete on its own; edges reach out to other cards and may point at nothing yet. Nothing is inferred: what the author wrote is what the model carries, and what the model carries is what the card draws, so a recipe someone wrote down survives as what they wrote rather than as a tool's reading of it.

The overall goal is a suite of tooling that can be used for archival of valuable recipes stored in human readable cards. The spirit of this holds. If a end-user wants to actually use the recipe, they can view it and use it in a similar way on a mobile device for actually cooking in a real kitchen.

**Lineage & naming (open).** The core is a clean-room TypeScript reimplementation in the Recipe Grid lineage. Its relationship to Recipe Grid 2 mirrors Grid 2's own relationship to its predecessor: largely a superset, not strictly backward-compatible -- a G2 recipe with title-derived scaling needs a conversion pass to YAML frontmatter, and the recipe-in-recipe named-output construct is unsupported. Upgrading is light, not arduous. This is not "Recipe Grid 3" -- not a successor version but a parallel reimplementation. Formal project name: TBD (package: @wendall911/recipe-grid).

**Why it forked.** Grid 2 is a real graph, but every edge terminates inside its own page. Here an edge points anywhere -- another card, off-site, or nothing yet -- so a dough shared by nine recipes is one card the nine link to, not nine copies that drift apart. A reference resolving to nothing is a legitimate state; forcing it to resolve is what makes an author bend the recipe to satisfy the tool. The compiler builds and decides nothing for the same reason: whether a recipe is well-formed is a separate question, asked when a consumer wants it.

## Examples That Inspired This Project
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

The novel piece is the core: parser + framework-neutral flexbox (layout, base CSS, data bindings), publishable on its own. A separate Svelte hedless component package wraps the core's structure for Svelte consumers; a future `-react` package would do the same. Structure/layout live once in the core, so all wrappers and both apps share one implementation.

**Package naming:** local package names are `@wendall911/recipe-grid` and `@wendall911/recipe-grid-svelte`. Directory names match the package names (`packages/recipe-grid`, `packages/recipe-grid-svelte`). All four candidate npm names (scoped and unscoped) were verified available (registry 404) as of this writing. Scoped chosen to pair the two packages and match the account being secured; unscoped `recipe-grid` / `recipe-grid-svelte` remain the recorded alternative. `workspace:*` needs no npm account; publishing is a later, optional step.

1. **`packages/recipe-grid`** = `@wendall911/recipe-grid` -- the framework-agnostic **core**. Pure TypeScript, no framework binding. Ports the Recipe Grid 2 *input grammar* from recipe_grid (Python), AND owns everything framework-neutral about presenting a recipe: the grid **layout**, the structural **base CSS** (the flex that makes the recipe grid resolve), and the semantic structure. It exposes the renderable grid structure + stable `data-*` hooks; framework bindings render it, they do not re-implement it. This is the publishable, framework-neutral piece -- and the reason a `-react` sibling would be thin.

2. **`packages/recipe-grid-svelte`** = `@wendall911/recipe-grid-svelte` -- the **Svelte binding**. Depends on the core via `workspace:*`. It is a thin adapter that renders the core's grid structure as Svelte components (bits-ui-style, `data-recipe-grid-*`) and exposes a Svelte-idiomatic API. It does **not** own layout, base CSS, or data -- those live in the core so every binding (Svelte, a future React, etc.) shares one implementation instead of re-doing it. Ships unthemed; the app themes via the core's stable hooks.

3. **`apps/site`** -- static consumer (adapter-static). Imports the parser + the Svelte renderer, renders committed `.md` files, adds theme CSS. During parser development this site *is* the visual feedback loop: edit parser -> HMR -> see rendered recipe in the browser. No separate throwaway harness.

4. **`apps/editor`** -- later. Not static. Consumes the same parser + renderer (live preview reuses them). No formal architecture determined yet.

Why two packages, not one: the core solves parsing AND structure + data + layout ONCE, in a framework-neutral form. A framework binding (`-svelte` now, a future `-react`) is then a thin adapter over that shared core -- so adding a framework does not re-implement layout or base CSS, and both apps share one implementation.

## Data model

The object model lives in `packages/recipe-grid/src/model.ts` and is the interface the renderer consumes. It began as a superset of the Recipe Grid 2 semantic model (mossblaser's `recipe_grid`) and has since diverged into its own fork -- faithful where the two agree, deliberately different where this project's goals differ. A clean-room reimplementation of the *input grammar* and model, not a source port. The intent began as a 1:1 port; typed->untyped is not 1:1 -- TypeScript holds the shape decoratively, JavaScript is a different language with its own considerations, so the model is faithful where the languages agree and diverges where JS requires. The PEG layer is not reinvented (Peggy); divergence is at the model, not the parser. Recipe Grid 2 is a reference, not a canonical source.

Provenance is tagged per declaration in the model file:

- **[G2]** -- faithful to Recipe Grid 2.
- **[EXT]** -- FamilyRecipe divergence, not present in Recipe Grid 2.

**Nothing is derived.** Every value in the model has a preimage in the markdown, which is a DAG. Nothing is computed from something else's text, inferred from position, or normalised into a canonical form. An exact fraction stays exact; a decimal stays a decimal; the whitespace between a value and its unit survives, as does a trailing preposition. Where a canonical handle is useful it rides *alongside* the authored form and never replaces it. That is what lets the rendered DOM compile back to the markdown it came from.

Converting units, rescaling, reformatting -- a consumer does that with the handles the model provides. The core declines to, because those decisions are not recoverable once made.

**Core surface: `parse(md) -> RecipeModel`** -- `{ title, description, meta, structure, root }`. `structure` (part-tagged nodes) is what a framework binding wraps; `root`, a mount-directly DOM chunk for raw consumers and analysis. A binding consumes the first four; `root` is not needed by `-svelte`.

### Layout

The rendered layout is **flexbox**, not `<table>` and not CSS grid. Flexbox was chosen because it carries the semantics as well as the arrangement: a step is a row holding what feeds it beside its own action, and that nesting *is* the layout. A table would say the recipe is tabular, which it is not.

It is a defined structure for content: large content simply makes a cell/column taller. Recipes are shallow by design. A named region within a card groups part of it under a heading; a step that deserves its own card becomes one, reached by a cross-file reference. Nothing caps how large a card may grow -- what bounds it is whether it still reads on a screen, which is the author's judgement while looking at the rendered thing.

**Card and forest.** Each recipe is one **card** -- a single DAG, laid out in flexbox. A collection isn't a container of cards; the **cross-file `RecipeReference` edges between cards form the forest.** The card is whole and complete on its own; references tie the edges.

## Future

Each package will migrate to it's own repository once a 1.0 milestone can be identified. These will be published to npm. `apps/site` and `apps/editor` may host documentation and a "live demo" of the concept. That is yet to be determined, and is out of scope.
