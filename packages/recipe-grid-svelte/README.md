# @wendall911/recipe-grid-svelte

Accessibility-first, mobile-first, headless Svelte 5 binding for [`@wendall911/recipe-grid`](https://www.npmjs.com/package/@wendall911/recipe-grid).

It renders a recipe card from a recipe-grid Markdown string as composable Svelte components. The core owns parsing, layout, and accessibility; this binding is a thin adapter that renders the core's structure as Svelte and exposes a `Recipe.*` component API.

Unstyled and accessible primitives you compose into a card: it renders structure and stable `data-recipe-grid-*` hooks with no theme, so you own the styling. Composition is at the part level (title, description, card); the card itself stays faithful to recipe-grid's flexbox layout, so you customize with CSS through the hooks, not by rearranging the structure.

## Usage

`Recipe.Root` parses the markdown once and provides it to the parts you place inside it. Compose only the parts you want:

```svelte
<script lang="ts">
    import { Recipe } from '@wendall911/recipe-grid-svelte';
    import '@wendall911/recipe-grid-svelte/styles.css';

    /*
     * Your recipe markdown, loaded however you like (import, fetch, db...).
     * This package does not provide a loader.
     */
    const md = await getRecipeMarkdown();

    const title = 'Scale';
    const options = [
        { value: 0.5, label: '<sup>1</sup>/<sub>2</sub>X' },
        { value: 1, label: '1X' },
        { value: 2, label: '2X' },
    ];

    // Yours to apply; the control only reports the pick.
    let scale = $state(1);
</script>

<svelte:boundary>
    <Recipe.Root {md}>
        <Recipe.Title />
        <Recipe.Description />
        <Recipe.Scale {title} {options} onValueChange={(value) => (scale = value)} />
        <Recipe.Grid />
    </Recipe.Root>

    {#snippet failed()}
        <p>This recipe could not be loaded.</p>
    {/snippet}
</svelte:boundary>
```

Every part reads from `Recipe.Root` via context, so each one requires a `Recipe.Root` ancestor.

A recipe whose body the grammar cannot read has no card to draw: `Recipe.Root` throws while it initializes, and the boundary is what catches it. Frontmatter and the title/description header do not throw; if absent or unreadable, they fall back to their defaults, and the card still draws.

## Components

### `Recipe.Root`

Parses `md` and provides the parsed model to descendant parts. Renders its children; optionally wraps them in an element.

| prop       | type              | default | notes                                                                 |
|------------|-------------------|---------|-----------------------------------------------------------------------|
| `md`       | `string`          | -       | required; the recipe-grid markdown                                    |
| `as`       | `string`          | -       | wrapper element tag; omitted -> no wrapper, children render directly  |
| `path`     | `string`          | `#{slug}` | where a cross-file recipe reference points; `{slug}` is replaced with the target |
| `rel`      | `string`          | -       | optional; `rel` for a cross-file recipe reference                     |
| `children` | `Snippet`         | -       | the parts to render inside                                            |
| ...rest    | `Record<string, unknown>` | - | forwarded to the wrapper element **when `as` is set** (`md` / `as` / `path` / `children` are not forwarded) |

A recipe references another recipe by slug; `path` is where that resolves for your app. `{slug}` is substituted wherever it appears:

```svelte
<Recipe.Root {md} path={'/recipe/{slug}'}>
<Recipe.Root {md} path={'/recipe/{slug}/print'}>
```

### `Recipe.Title`

Renders the recipe title.

| prop | type     | default | notes                                                        |
|------|----------|---------|--------------------------------------------------------------|
| `as` | `string` | `h1`    | heading tag; pass `''` to render the raw title text, no element |

### `Recipe.Description`

Renders the recipe description.

| prop | type     | default | notes                                                             |
|------|----------|---------|-------------------------------------------------------------------|
| `as` | `string` | ``      | element tag; pass `'<element>'` to wrap the html chunk parsed from markdown |

### `Recipe.Scale`

Renders a `fieldset` and `legend` around one native radio per option. Renders nothing at all unless the recipe's `scalingType` is `servings`.

| prop            | type                        | default | notes                                              |
|-----------------|-----------------------------|---------|----------------------------------------------------|
| `title`         | `string`                    | -       | required; the `legend`                             |
| `options`       | `ScaleOption[]`             | -       | required; `{ value, label }`, in render order      |
| `onValueChange` | `(value: number) => void`   | -       | optional; called with the picked option's `value`  |

The radios share a `name` derived from the recipe's slug, so two cards on one page are separate groups. `label` is rendered as HTML -- markup works, and it is your string, so do not put untrusted input there. The option whose `value` is `1` starts selected; supply one if you want the card to return to its authored scale.

The control holds no state, and nothing to bind to. `onValueChange` gives you the selected value, and you apply the scaling.

Props that cannot draw a labeled control throw `RecipeScaleError` while the component initializes: a blank `title`, empty `options`, an option with a non-numeric `value` or blank `label`, duplicate `value`s, or an `onValueChange` that is not a function.

### `Recipe.Grid`

Renders the recipe card. Takes no props; it wraps the core's structure as DOM, one node at a time, carrying each node's `data-recipe-grid-*` markers through so you can style or bind against the rendered card.

## Metadata

The parsed model carries the recipe's frontmatter as `meta`: `scalingType`, `base`, `unitSystem`, and `slug` (the recipe's identifier). Read it two ways.

Without rendering -- parse once and read `meta`, e.g., to map a `slug` to a route. This parses, so it throws on a recipe that will not parse:

```ts
import { Recipe } from '@wendall911/recipe-grid-svelte';

const { meta } = new Recipe.RecipeContext(md).parsed;
```

From a `Recipe.Root` descendant, read the model from context:

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

The binding ships no styles of its own and no theme; it applies styles via the `data-recipe-grid-*` hooks on the rendered card.

## Recipe markdown format

The core `recipe-grid` defines the format. See its canonical documentation for the format and the model it compiles to.

## Exported types

- `RecipeContext` - the driver Root places in context; its `parsed` holds `{ title, description, meta, structure, root }`.
- `ScaleOption` - one scale `Recipe.Scale` offers, and the text that labels it.
- `OnScaleChangeFn` - the callback `Recipe.Scale` hands the picked scale to.
- `RecipeParseError` - re-exported from the core; what `Recipe.Root` throws on a recipe that will not parse. A boundary catches everything beneath it, so test for this to distinguish a broken recipe from everything else, then rethrow the rest.
- `RecipeScaleError` - what `Recipe.Scale` throws when its props cannot draw a labeled control.

## License

Licensed under AGPL-3.0-or-later. Copyleft protects users' freedom; AGPL extends it to network/SaaS use.
