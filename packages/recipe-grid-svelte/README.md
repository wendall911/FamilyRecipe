# @wendall911/recipe-grid-svelte

Headless Svelte 5 binding for [`@wendall911/recipe-grid`](https://www.npmjs.com/package/@wendall911/recipe-grid).
It renders a recipe card from a recipe-grid markdown string as composable Svelte components. The core owns parsing, layout, and accessibility; this binding is a thin adapter that renders the core's structure as Svelte and exposes a `Recipe.*` component API.

Unstyled and accessible primitives you compose into a card: it renders structure, ARIA, and stable `data-recipe-grid-*` hooks with no theme -- you own the styling. Composition is at the part level (title, description, card); the card itself stays faithful to recipe-grid's flexbox layout, so you customize with CSS through the hooks, not by rearranging the structure.

## Install

```sh
pnpm add @wendall911/recipe-grid-svelte @wendall911/recipe-grid
```

## Usage

`Recipe.Root` parses the markdown once and provides it to the parts you place inside it. Compose only the parts you want:

```svelte
<script lang="ts">
    import { Recipe } from '@wendall911/recipe-grid-svelte';
    import '@wendall911/recipe-grid-svelte/styles.css';

    // Your recipe markdown, loaded however you like (import, fetch, db...).
    // This package does not provide a loader.
    const md = await getRecipeMarkdown();
</script>

<Recipe.Root {md}>
    <Recipe.Title />
    <Recipe.Description />
    <Recipe.Grid />
</Recipe.Root>
```

Every part reads from `Recipe.Root` via context, so each one requires a `Recipe.Root` ancestor.

## Components

### `Recipe.Root`

Parses `md` and provides the parsed model to descendant parts. Renders its children; optionally wraps them in an element.

| prop       | type              | default | notes                                                                 |
|------------|-------------------|---------|-----------------------------------------------------------------------|
| `md`       | `string`          | -       | required; the recipe-grid markdown                                    |
| `as`       | `string`          | -       | wrapper element tag; omitted -> no wrapper, children render directly  |
| `children` | `Snippet`         | -       | the parts to render inside                                            |
| ...rest    | `Record<string, unknown>` | - | forwarded to the wrapper element **when `as` is set** (`md` / `as` / `children` are not forwarded) |

### `Recipe.Title`

Renders the recipe title.

| prop | type     | default | notes                                                        |
|------|----------|---------|--------------------------------------------------------------|
| `as` | `string` | `h1`    | heading tag; pass `''` to render the raw title text, no element |

### `Recipe.Description`

Renders the recipe description.

| prop | type     | default | notes                                                             |
|------|----------|---------|-------------------------------------------------------------------|
| `as` | `string` | `p`     | element tag; pass `''` to render the raw description text, no element |

### `Recipe.Grid`

Renders the recipe card. Takes no props; it wraps the core's structure as DOM, one node at a time, carrying each node's `data-recipe-grid-*` markers through so you can style or bind against the rendered card.

## Metadata

The parsed model carries the recipe's frontmatter as `meta`: `scalingType`, `base`, and `slug` (the recipe's identifier). Read it two ways.

Without rendering -- parse once and read `meta`, e.g. to map a `slug` to a route:

```ts
import { Recipe } from '@wendall911/recipe-grid-svelte';

const { meta } = new Recipe.RecipeContext(md).parsed;
```

From a `Recipe.Root` descendant -- read the model from context:

```svelte
<script lang="ts">
    import { getContext } from 'svelte';
    import { Recipe } from '@wendall911/recipe-grid-svelte';

    const { meta } = getContext<Recipe.RecipeContext>('recipe').parsed;
</script>
```

## Styles

The headless layout stylesheet lives in the core and is re-exported here as a single import:

```ts
import '@wendall911/recipe-grid-svelte/styles.css';
```

The binding ships no styles of its own and no theme; style via the `data-recipe-grid-*` hooks on the rendered card.

## Recipe markdown format

The format is defined by the core, `recipe-grid`. See its canonical documentation for the format and the model it compiles to.

## Exported types

- `StructureNode` - re-exported from the core; the render structure a binding walks.
- `RecipeContext` - the driver Root places in context; its `parsed` holds `{ title, description, meta, structure, root }`.

## License

Licensed AGPL-3.0-or-later. Copyleft protects users' freedom; AGPL extends it to network/SaaS use.
