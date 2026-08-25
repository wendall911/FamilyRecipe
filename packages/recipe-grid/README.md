# @wendall911/recipe-grid

Write a recipe as Markdown; get back a structured flexbox card and a headless stylesheet. Accessibility-first, mobile-first, headless, framework-agnostic. ESM, typed.

A recipe card you can lay on the counter and cook from: one recipe, whole, readable at a glance. The Markdown is the complete recipe, readable on its own and editable by hand, and the card is drawn from it.

Rendered card without title and description:

![Cheesecake Recipe](https://raw.githubusercontent.com/wendall911/FamilyRecipe/main/packages/recipe-grid/docs/images/cheesecake.png)

```
---
scalingType: fixed
slug: cheesecake
---
Classic Ricotta Cheesecake
====

A classic cheesecake recipe shared by a friend who worked in NYC as a head chef.

This recipe is best with a springform pan. Line the bottom of the springform pan with parchment paper. Separate the whites and yolks ahead of time. If you're using a blender to mix the main ingredients, put the separated yolks into the blender.

    6 large egg whites
    6 large egg yolks
    2/3 cup sugar
    2 tsp vanilla extract
    2 '15oz whole milk ricotta cheese'
    2 tsp lemon zest

    Egg White Foam := blend on high speed until stiff peaks form(
        egg whites
    )

    Ricotta Base := Blend one tub ricotta at a time(
        Blend until thick and yellow(
            egg yolks,
            sugar,
            vanilla extract,
        ),
        '15oz whole milk ricotta cheese',
        lemon zest
    )

    Chill for 6 hours or overnight (
        Bake for 80 minutes (
            Preheat oven to 325°F,
            Smooth top(
                Scrape into prepped springform pan(
                    Fold foam into ricotta base(
                        Egg White Foam,
                        Ricotta Base
                    )
                )
            ),
        )
    )
```

## API

`parse` takes the markdown and returns the card in the form a consumer needs:

 - **`structure`** - the render structure a framework binding walks, one node at a time. Each node carries a part marker, the semantic tag it renders as and the data a consumer computes with: a scalable value, a unit key and a target slug.
 - **`root`** - the same structure as elements, a serializable DOM chunk to mount directly.
 - **`meta`** - the recipe's own metadata: its slug, and how it scales.
 - **`title`** and **`description`** - the human-facing header.

The data bindings are available on all mutable properties. A quantity with units uses grammar constants and types from [`parse-ingredient`](https://www.npmjs.com/package/parse-ingredient) ([source](https://github.com/jakeboone02/parse-ingredient)). A scalable value carries its base amount, and the recipe metadata carries its scaling.

The headless stylesheet ships alongside. It provides layout and flow only, defining how a box lays out its children and how it takes up space from its parent. The card is semantically correct and will work on a phone screen and a desktop browser. You can style colors, borders, spacing, and type as you like.

## How It Works

Every value the card produces has a preimage in the markdown. What the author wrote is what the model carries, and what the model carries is what the card draws, so a recipe someone wrote down survives as written.

### Grammar Parser

The `md` body reads as a valid Directed Acyclic Graph and leverages [Peggy](https://www.npmjs.com/package/peggy) for grammar to produce a full AST for compilation. `parse` throws `RecipeParseError` if the syntax is invalid.

### DAG Compiler

Compiles a DAG from the parsed AST. The compiler does no validation or linting, so a nonsensical recipe is an authoring issue, not enforced at the compiler level.

### Extracted Flexbox DOM

The extracted output is **archival quality**. `1/2` stays an exact fraction and `0.5` stays a decimal though both are the same magnitude; a quantity keeps the whitespace between its value and its unit; a quoted description keeps its parens and commas verbatim. Where a canonical handle is useful, like a unit key, a target slug or a base value to scale from, it rides alongside what the author wrote rather than replacing it. The card carries back to the markdown it came from, which is what makes the format archival.

## Integrations

 - [`@wendall911/recipe-grid-svelte`](https://www.npmjs.com/package/@wendall911/recipe-grid-svelte) renders a recipe card from a recipe-grid markdown string as composable Svelte components. The core owns parsing, layout, and accessibility; this binding is a thin adapter that renders the core's structure as Svelte and exposes a `Recipe.*` component API. Includes an optional scaling component, with documentation for full website integration.

## Documentation

See: [`docs/`](./docs).

## Credits

A TypeScript re-implementation of [Grid 2](https://github.com/mossblaser/recipe_grid) parser with variant syntax. Not a faithful fork of Grid 2, but would not be possible without the amazing work of [mossblaser](https://github.com/mossblaser).

## License

AGPL-3.0-or-later.
