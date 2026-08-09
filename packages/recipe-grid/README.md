# @wendall911/recipe-grid

A recipe library that renders a recipe as a card: one recipe on one surface, ingredients on the left combining rightward through the steps to the finished recipe. An ingredient feeds a step, an ingredient can be used in multiple places, and it nests where it needs to inside the card. The card is nested flexbox, and its shape comes from the recipe.

Write the recipe as markdown; get back the card's structure and a headless stylesheet. Accessibility-first, mobile-first, headless, framework-agnostic. ESM, typed.

A recipe card is the card you lay on the counter and cook from: one recipe, whole, readable at a glance. The markdown is that recipe, readable on its own and edited by hand, and the card is drawn from it.

## API

`parse` takes the markdown and returns the card in the forms a consumer needs:

- **`structure`** -- the render structure a framework binding walks, one node at a time. Each node carries a part marker, the semantic tag it renders as, and the data a consumer computes with: a scalable value, a unit key, a target slug.
- **`root`** -- that same structure as elements, a serialisable DOM chunk to mount directly.
- **`meta`** -- the recipe's own metadata: its slug, and how it scales.
- **`title`** and **`description`** -- the human-facing header.

The data bindings are what a consumer computes with. A quantity carries its unit as a key from [`parse-ingredient`](https://www.npmjs.com/package/parse-ingredient) ([source](https://github.com/jakeboone02/parse-ingredient)), whose vocabulary is also the grammar's, so its `convertUnit` takes the key directly. A scalable value carries its base amount, and the recipe carries how it scales, when the author declared that it does. The card renders the same whether or not a consumer reaches for either.

The headless stylesheet ships alongside. It is flow only -- which way a box lays its children out and how it takes space from its parent -- so the card lays out correctly on a phone before a theme touches it. Colors, borders, spacing, and type are yours.

Two properties hold across all of it.

**The grammar is the gate.** A body reads as a valid Directed Acyclic Graph or the document is broken: `parse` throws `RecipeParseError` and there is one place to catch it. Whether a well-formed recipe is a *sensible* recipe -- every ingredient reached, no hanging nodes -- is a separate question, asked off the render path.

**Nothing is discarded.** Each form adds; none rewrites. `1/2` stays an exact fraction and `0.5` stays a decimal though both are the same magnitude; a quantity keeps the whitespace between its value and its unit; a quoted description keeps its parens and commas verbatim. Where a canonical handle is useful -- a unit key, a target slug, a base value to scale from -- it rides alongside what the author wrote rather than replacing it. The card carries back to the markdown it came from, which is what makes the format archival.

## Integration

A framework binding is the usual entry. [`@wendall911/recipe-grid-svelte`](https://www.npmjs.com/package/@wendall911/recipe-grid-svelte) renders the card as Svelte components; this package is what it compiles with. A consumer without a framework mounts the DOM chunk this package returns.

## Documentation

See: [`docs/`](./docs).

## License

AGPL-3.0-or-later.
