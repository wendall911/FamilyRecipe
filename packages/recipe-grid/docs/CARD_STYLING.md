# Card Styling - Quick Reference

A rendered recipe card is nested `div`s carrying attributes. The headless stylesheet lays them out -- which way a box flows, how it takes space from its parent. A theme draws the rest: borders, colors, spacing, type.

Three attribute layers, and the prefix says who reads it:

| attribute                     | who reads it                                          |
|-------------------------------|-------------------------------------------------------|
| `data-recipe-grid-<part>`     | a marker naming what a box is; a rule selects on it   |
| `data-recipe-grid-*`          | model data a consumer computes with                   |
| `recipe-grid-side`, `-flow`, `-edge` | facts the shape pass resolved; a rule matches on them |

The `data-` prefix means a consumer reads the value. The unprefixed attributes are matched and nothing is taken from them.

---

## Parts

Every element the core emits carries one part marker, with an empty value, as a class-free hook. The tag is a semantic fact about what the part is; layout stays in CSS.

| marker                                 | is                                                              | tag    | laid out by the headless sheet |
|----------------------------------------|-----------------------------------------------------------------|--------|--------------------------------|
| `data-recipe-grid-root`                | the recipe container, one per recipe                             | `div`  | --                             |
| `data-recipe-grid-card`                | the region holding the recipe's trees, one under another         | `div`  | column                         |
| `data-recipe-grid-title`               | the recipe title                                                 | `h1`   | --                             |
| `data-recipe-grid-step`                | a combining action over its inputs: the bracket itself           | `div`  | row                            |
| `data-recipe-grid-inputs`              | a step's input column, left of its action                        | `div`  | column; takes what it needs    |
| `data-recipe-grid-action`              | a step's own action, right of what feeds it                      | `div`  | content box; takes what's left |
| `data-recipe-grid-ingredient`          | an ingredient leaf                                               | `div`  | content box                    |
| `data-recipe-grid-sub-recipe`          | a named region: its header band and body together                | `div`  | column                         |
| `data-recipe-grid-sub-recipe-header`   | the heading label of a `:=` sub-recipe                           | `h2`   | content box                    |
| `data-recipe-grid-sub-recipe-body`     | everything under that band                                       | `div`  | column                         |
| `data-recipe-grid-reference`           | a use site wrapping the node it transcludes                      | `div`  | column                         |
| `data-recipe-grid-remainder`           | a "use the rest" note at a reference                             | `div`  | --                             |
| `data-recipe-grid-recipe-reference`    | a cross-file link to another recipe by slug                      | `a`    | content box                    |
| `data-recipe-grid-quantity`            | an amount rendered inline with an ingredient or reference        | `span` | --                             |
| `data-recipe-grid-scaled-value`        | a value that rescales with the recipe                            | `span` | --                             |
| `data-recipe-grid-uom-name`            | the unit name as the author wrote it                             | `span` | --                             |
| `data-recipe-grid-ingredient-description` | what the ingredient is                                        | `span` | --                             |

A content box is `display: flex; align-items: center` -- its children are text rather than more boxes. A part with `--` in the last column carries no rule of its own.

---

## Inside a leaf

A content box holds one `<p>`, and the paragraph's children are spans and text nodes interleaved, in the order the author wrote them.

A span exists exactly where something is bound. Everything between -- the spacing, a preposition like `of` -- is a bare text node, because it belongs to the line rather than to either piece it sits between. Swapping a unit's text touches the `uom-name` span and leaves the space beside it alone.

```html
<div data-recipe-grid-ingredient recipe-grid-flow="leaf" data-recipe-grid-uom-id="cup">
  <p>
    <span data-recipe-grid-scaled-value data-recipe-grid-value='{"numerator":1,"denominator":2}'>1/2</span>
    <span data-recipe-grid-uom-name>cup</span>
    of
    <span data-recipe-grid-ingredient-description>butter</span>
  </p>
</div>
```

So the presence of a span is the signal: marked means bound, unmarked means connective text a consumer does not own. A rule reaching the paragraph's own children uses `[recipe-grid-flow='leaf'] > p > *`, which selects the spans and nothing between them.

---

## Model data

The values a consumer computes with, distinct from the markers a rule selects on. Each rides the element the value belongs to.

| attribute                     | on                        | is                                                        |
|-------------------------------|---------------------------|-----------------------------------------------------------|
| `data-recipe-grid-value`      | `scaled-value`            | the authored number, serialised: a JS number, or `{numerator, denominator}` for a fraction |
| `data-recipe-grid-uom-id`     | `ingredient`              | the canonical unit key a conversion works from            |
| `data-recipe-grid-target-slug`| `recipe-reference`        | the recipe a cross-file link points at; the core emits no `href` |
| `data-recipe-grid-scaling-type`, `-unit-system`, `-base` | `root` | the recipe's frontmatter, read before descending into the card |

A scaled value carries both: the marker a rule selects on, and the base a scaler multiplies. Rewriting the span's text leaves the base intact, so rescaling is reversible and the authored amount survives.

---

## Where a box sits

Two unprefixed attributes, both written by the shape pass.

**`recipe-grid-side`** -- what a box is to its parent: `inputs`, `action`, `header`, `body`, or `root`. The inputs column and a region's body have no part of their own, so this is what a rule targets them by.

**`recipe-grid-flow`** -- which way a box lays its children out: `row`, `column`, or `leaf` when its children are content. What `side` is to a box's parent, this is to its children.

```css
/* every box whose children are text */
[recipe-grid-flow='leaf'] { ... }

/* the column that feeds a step */
[recipe-grid-side='inputs'] { ... }
```

---

## Boundaries

**`recipe-grid-edge`** -- which of a box's own edges are its container's rather than a line between it and a neighbor: `start`, `end`, `both`, or absent when the box has a neighbor on each side.

The edges named are along the parent's flow. In a row, `start` is left and `end` is right; in a column, `start` is top and `end` is bottom. The parent carries its own flow, so a rule pairs the two: the parent's `recipe-grid-flow` says which axis, the child's `recipe-grid-edge` says which end of it.

| the child carries | with a `row` parent      | with a `column` parent  |
|-------------------|--------------------------|-------------------------|
| `start`           | its left is the parent's | its top is the parent's |
| `end`             | its right is the parent's| its bottom is the parent's |
| `both`            | left and right           | top and bottom          |
| absent            | a neighbor on each side | a neighbor on each side |

This is what a border bounds a group with instead of dividing two of its members.

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
[recipe-grid-flow='column'] > :not([recipe-grid-edge='start']):not([recipe-grid-edge='both']) {
    border-top: 1px solid #3f3f46;
}

/* row flow: a line left of every box that has one before it */
[recipe-grid-flow='row'] > :not([recipe-grid-edge='start']):not([recipe-grid-edge='both']) {
    border-left: 1px solid #3f3f46;
}
```

A box carrying `start` or `both` has nothing before it along its parent's flow, so its leading side is the card's own edge, already drawn. Absent means neighbors on both sides -- an interior division, which is where a line belongs.

### A banded sub-recipe header

```css
[data-recipe-grid-sub-recipe-header] {
    background: #27272a;
}
```

### Room around the content

The boxes whose children are text, rather than the boxes that group them:

```css
[recipe-grid-flow='leaf'] {
    padding: 0.25rem 0.5rem;
}
```
