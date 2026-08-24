# Card Styling - Quick Reference

A rendered recipe card is a flexbox with data, structure and styling attributes.

## Parts

Every element the core emits carries exactly one part marker, on every instance, with an empty value. A flat attribute selector is therefore exhaustive: `[data-recipe-grid-ingredient-description]` reaches every ingredient description in the card, at any depth, inside references and sub-recipes alike.

| marker                                    | is                                                       | tag    |
|-------------------------------------------|----------------------------------------------------------|--------|
| `data-recipe-grid-root`                   | the recipe container for metadata bindings               | `div`  |
| `data-recipe-grid-card`                   | the region that lays out the recipe                      | `div`  |
| `data-recipe-grid-title`                  | the recipe title                                         | `h1`   |
| `data-recipe-grid-step`                   | a combining action over its inputs: the bracket itself   | `div`  |
| `data-recipe-grid-inputs`                 | a step's input column, left of its action                | `div`  |
| `data-recipe-grid-action`                 | a step's own action, right of what feeds it              | `div`  |
| `data-recipe-grid-ingredient`             | an ingredient leaf                                       | `div`  |
| `data-recipe-grid-sub-recipe`             | a `:=` region: header band and body together             | `div`  |
| `data-recipe-grid-sub-recipe-header`      | the region's heading label                               | `h2`   |
| `data-recipe-grid-sub-recipe-body`        | everything under that band                               | `div`  |
| `data-recipe-grid-reference`              | an intra-document reference to a sub-recipe output       | `div`  |
| `data-recipe-grid-remainder`              | a "use the rest" note at a reference                     | `div`  |
| `data-recipe-grid-recipe-reference`       | a cross-file reference; its `a` carries the slug         | `div`  |
| `data-recipe-grid-quantity`               | an amount rendered inline                                | `span` |
| `data-recipe-grid-ingredient-description` | the ingredient's authored text                           | `span` |
| `data-recipe-grid-scaled-value`           | a value that rescales with the recipe                    | `span` |
| `data-recipe-grid-uom-name`               | the authored unit name                                   | `span` |

## Structure

Two attributes, both resolved by the shape pass, both with closed value sets. They reach a box by its position in the layout rather than by which part it is, so one rule matches at any depth.

**`data-recipe-grid-flow`** -- which way a box lays its children out: `row`, `column`, or `leaf` when its children are text.

**`data-recipe-grid-side`** -- what a box is to its parent: `inputs`, `action`, `header`, `body`, or `root`. The inputs column and a region's body carry no part marker of their own, so this is what reaches them.

Selecting on flow is what keeps a rule flat. `[data-recipe-grid-flow='column'] > …` applies to every column in the card; the alternative is enumerating which parts are columns in every rule and revising that list whenever a part is added.

## Combining identity and position

A part marker is uniform, the context it appears in is not. An ingredient appears as a bare leaf, inside a reference, and inside a step's inputs.

```css
/* every ingredient */
[data-recipe-grid-ingredient] { }

/* only the ones sitting directly in a column */
[data-recipe-grid-flow='column'] > [data-data-recipe-grid-ingredient] { }
```

## Boundaries

**`data-recipe-grid-edge`** -- which of a box's own edges are its container's rather than a line between it and a neighbor: `start`, `end`, `both`, or absent when the box has a neighbor on each side.

The edges named are along the parent's flow. In a row, `start` is left and `end` is right; in a column, `start` is top and `end` is bottom. The parent carries its own flow, so a rule pairs the two: the parent's `data-recipe-grid-flow` says which axis, the child's `data-recipe-grid-edge` says which end of it.

| the child carries | with a `row` parent      | with a `column` parent  |
|-------------------|--------------------------|-------------------------|
| `start`           | its left is the parent's | its top is the parent's |
| `end`             | its right is the parent's| its bottom is the parent's |
| `both`            | left and right           | top and bottom          |
| absent            | a neighbor on each side | a neighbor on each side |

This is what a border bounds a group with instead of dividing two of its members.

## Data attributes

Values a consumer computes with. These are not styling hooks.

| attribute                                                | on                                | is                                                                     |
|----------------------------------------------------------|-----------------------------------|------------------------------------------------------------------------|
| `data-recipe-grid-value`                                 | `scaled-value`                    | the authored number, serialised: a JS number, or `{numerator, denominator}` for a fraction |
| `data-recipe-grid-uom-id`                                | `ingredient`                      | the key into parse-ingredient's `unitsOfMeasure`. The authored text is the `uom-name` span inside |
| `data-recipe-grid-target-slug`                           | the `a` inside `recipe-reference` | the recipe a cross-file link points at; the core emits no `href`        |
| `data-recipe-grid-scaling-type`, `-base`, `-unit-system` | `root`                            | the recipe's scaling metadata                                           |

The text inside `scaled-value` and `uom-name` is rewritten at runtime when a recipe rescales or converts. A rule anchored to that text breaks on the next scale.

---

## Styling the Card

Examples. A card takes whatever styling a consumer wants; these show how the attributes above are reached.

### Table-looking borders

A line drawn between two boxes rather than around each one: one line per division, on the leading side only, and the card's own outer boundary once.

```css
[data-recipe-grid-card] {
    border: 1px solid #3f3f46;
}

/* column flow: a line above every box that has one before it */
[data-recipe-grid-flow='column'] > :not([data-recipe-grid-edge='start']):not([data-recipe-grid-edge='both']) {
    border-top: 1px solid #3f3f46;
}

/* row flow: a line left of every box that has one before it */
[data-recipe-grid-flow='row'] > :not([data-recipe-grid-edge='start']):not([data-recipe-grid-edge='both']) {
    border-left: 1px solid #3f3f46;
}
```

A box carrying `start` or `both` has nothing before it along its parent's flow, so its leading side is the card's own edge, already drawn. Absent means neighbors on both sides -- an interior division, which is where a line belongs.

### Sub-Recipe Header Example

```css
[data-recipe-grid-sub-recipe-header] {
    background: #27272a;
}
```

### Padding Example

The boxes whose children are text, rather than the boxes that group them:

```css
[data-recipe-grid-flow='leaf'] {
    padding: 0.25rem 0.5rem;
}
```
