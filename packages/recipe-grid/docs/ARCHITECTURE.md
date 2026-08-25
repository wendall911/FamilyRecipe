# Architecture

A recipe card is typically a card you lay on the counter and cook from. It holds one recipe in full: everything that recipe needs, readable at a glance. Complex ingredients that are shared by multiple other recipe cards have their own card so there is no duplication, only a reference from the consuming recipe to the shared recipe card. A box of cards is a collection.

Cards outlast the people who wrote them because they are paper. No format, no application, nothing between the writing and the reading. `recipe-grid` carries that forward: the recipe is a Markdown file a person writes and edits, the card is drawn from it, and the card is faithful to the file. This is an archival format, and the rest of the architecture follows.

## Fidelity

A recipe is not a list of ingredients followed by a list of steps. Ingredients combine, and what they combine into gets combined again; an ingredient made once can be used in two places later.

The `.md` holds the graph literally: it does not describe one; it is one, written so a person can read it.

Every value the card produces has a preimage in the markdown. What the author wrote is what the model carries, and what the model carries is what the card draws, so a recipe someone wrote down survives as what they wrote.

## Bindings

Fidelity is kept at the value: what the author wrote is what is rendered, down to the character.

A number keeps the kind it was written in. `1/2` stays an exact fraction and `0.5` stays a decimal. A quantity keeps the whitespace between its value and its unit and the trailing preposition, leading space and all. A quoted description keeps its parens, commas, and `%` verbatim.

Where a canonical handle is useful, it rides alongside the authored form:

| authored                | handle                              |
|-------------------------|-------------------------------------|
| `cloves`, as written    | `unitOfMeasureID: clove`            |
| the number as drawn     | the base value, serialised whole    |
| `[Dough](pizza-dough)`  | `targetSlug: pizza-dough`           |

Both are carried, and neither replaces the other: one is what renders, the other is the handle a consumer looks up, converts with, or resolves. A consumer that converts a unit before scaling needs both together, so both ride the ingredient.

**The unit vocabulary.** Unit names are adopted from `parse-ingredient`. They cross into the core twice, from that one source.

When parsing, unit names become an ordered choice in the grammar: canonical key, short form, plural, and every alternate, longest first.

At compile time, the authored name maps back to its canonical key. Both ride the quantity `cloves` as written, with `clove` as the key, so a consumer converts with the same vocabulary the grammar was built from.

The rendered DOM carries back to the markdown it came from. A decompiler could reconstruct the `.md` from the card.

## Edges

Edges run inside a card and out of it. Inside, they are what the graph is made of; outward, they reach another card, and that is what makes a box of cards a collection rather than a pile.

Within one card, the nodes nothing else reaches are where it is entered, and everything else is reached through them. A node reached from two places is one node, not a copy in each.

**An amount rides the edge, not the node.** A shared node is reached from more than one place, and each use draws its own: a step may restate a measure, ask for what is left, or name the output with no amount at all. The ingredient carries the amount that exists; each reference carries what that line drew.

What is left of an ingredient after earlier draws is a question for a validator.  The reference exists so the graph has the edge, and the wording exists so the card reads as written.

**A cross-file edge is a slug.** A card is whole whether or not its target exists, which is what lets a collection be assembled one card at a time: a dough shared by nine recipes is one card the nine link to. The link carries the slug and the link text; a consumer resolves it into whatever it needs: an anchor on the page, a route, an external URL. An unresolved reference is a legitimate state, just like a hyperlink.

The cards and those edges are the forest. A collection is not a container of cards; the edges between them are what ties it together.

## Layout

The card is flexbox. A step is a row holding what feeds it on the left and its own action on the right; items feeding it are a column, and the step sits beside the whole stack.

The following two extraction passes build it into a consumable headless DOM structure:

### Extract Shape

The first pass answers what nests inside what, and on which side. It emits no tags, no text, no bindings -- only the boxes.

It is a separate pass because a single bottom-up recursion cannot express card-level facts. A node visited on the way up knows what lies under it and nothing else: not which column it shares with its siblings, not what sits to its right, not where a region begins. Those are facts about the whole card, so they need a stage where the whole card is in hand.

Three steps, two of which walk the DAG:

**Collect** finds where the card is entered. A node the card reaches from somewhere else is drawn at that use site, so what is left over -- the nodes nothing reaches -- is where the card begins. Two kinds of reach count: a reference edge, and a use site naming a declared cross-file link. The second carries no edge of its own, because a bare markdown link is self-naming and has no label to bind, so it is matched by name.

**Build** descends from each of those, making a box for every node it arrives at and every grouping the layout needs that the model has no node for: the column holding a step's inputs, and the body of a sub-recipe region. Arriving at a shared node twice makes a box at each use site, one node in the graph, drawn wherever it is used. A reference makes a box of its own around the node it transcludes, and that box is where the draw the use site made lives.

**Relate** fills in what each box touches, reading the finished boxes rather than the DAG. Adjacency is sibling order within a parent, and a box's siblings do not exist while it is being built, which is why it is its own step. A box at either end of its parent's children touches nothing on that side: its edge is the parent's edge, so the border there is the boundary of the group rather than a line between two members.

Each box carries what it is to its parent (`side`: inputs, action, header, body, root), how it lays its own children out (`flow`: row, column, leaf), the regions containing it, and what it touches.

### Extract Structure

The second pass fills those boxes with content: a tag, a part marker, the `data-*` bindings, the semantic HTML attributes a node sets, and the literal text of a leaf. It asks no structural question.

Dispatch is on the box rather than the model, `side` before node kind: a step's row box and its action leaf carry the same step, as do a sub-recipe's region box and its header. Children are always the box's children, so the model never recurses, because the shape pass already did that.

What comes out is every element the DOM needs, not a sketch of it, including the inline pieces a box expands into: a quantity span, a marked span for each number that rescales, the literal text around them. A renderer turns this into elements and makes no structural decision of its own.

## DOM

DOM is built with semantic structure. Markers and bindings are added for:

 - `data-recipe-grid-<part>` - The semantic HTML tag each part renders as.
 - `data-recipe-grid-<data_key>` - A data attribute that holds authored values. Scalable values, unit keys, target slugs, etc.
 - `data-recipe-grid-<layout>` - Markers for layout.
 - `data-recipe-grid-<styling>` - Markers for styling.

`data-recipe-grid-<layout>` - The structure attributes. Resolved by the shape pass, written onto the element so a rule matches on position instead of rebuilding it.
  - `side`: what the box is to its parent: `inputs`, `action`, `header`, `body`, `root`. The inputs column and a region's body have no part marker, so a rule reaches them by this.
  - `flow`: how the box lays out its children: `row`, `column`, `leaf` when its children are text. Pairs with a child's `edge`: flow gives the axis, edge gives the end.

 `data-recipe-grid-<styling>`The styling markers. The surfaces a theme decorates.
  - `edge`: which of a box's edges are its container's rather than a division with a neighbor: `start`, `end`, `both`, absent when it has a neighbor on each side. Along the parent's flow: row is left/right, column is top/bottom. A border on a container's edge bounds the group instead of dividing two members.

The headless stylesheet is flow only: how a box lays out its children and how it takes space from its parent.

## API

```ts
parse(md: string): RecipeModel
```

Returns:

```ts
{
    title,
    description,
    meta,
    structure,
    root
}
```

- `structure`: the render structure: part-tagged nodes that a framework binding can wrap and render as a component.
- `root`: built element tree: a serializable DOM chunk the consumer mounts directly.
- `meta`: the recipe's own metadata, its slug, how it scales, etc.

Both come from one pass, so consumers take whichever they need.

One failure: the grammar is the gate. A body either reads as a valid DAG or the document is broken, so `parse` throws `RecipeParseError` and there is one place to catch it. Whether a well-formed recipe is a *sensible* recipe is a separate question, asked by a consumer that wants it.

The scaling metadata sits on the root of the card, and the base values sit on the numbers, so a consumer scales the card by reading what is already there.  Converting units, rescaling, resolving a link, deciding a minimum width: each is a consumer's move, made with the handles the card carries.
