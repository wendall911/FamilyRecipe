# Architecture

A recipe card is a thing you lay on the counter and cook from. It holds one recipe, whole: everything that recipe needs, readable at a glance. If a piece of it is used by other recipes too, that piece is its own card, and the ones that need it point at it. A box of cards is a collection tied together by which cards point at which.

Cards outlast the people who wrote them because they are paper -- no format, no application, nothing between the writing and the reading. `recipe-grid` carries that forward: the recipe is a markdown file a person writes and edits, the card is drawn from it, and the card is faithful to the file. Archival is the requirement, and the rest of the architecture follows from it.

## Fidelity

A recipe is not a list of ingredients followed by a list of steps. Things combine, and what they combine into gets combined again; a thing made once can be used in two places later. That is a directed acyclic graph, and it is what a recipe has always been.

For the writing to survive, the graph has to survive with it. A name declared once and used again is one thing used twice, and a format that copies it into two places has already lost what the author said. So the `.md` holds the graph literally: it does not describe one, it is one, written so a person can read it. That is the sense in which archival is a requirement rather than an aspiration -- it is measured on whether the graph and the words come back exactly.

Every value the core produces has a preimage in the markdown. What the author wrote is what the model carries, and what the model carries is what the card draws, so a recipe someone wrote down survives as what they wrote.

That contract is what the rest of this document describes.

## Bindings

Fidelity is kept at the value: what the author wrote is what renders, down to the character.

A number keeps the kind it was written in. `1/2` stays an exact fraction and `0.5` stays a decimal, though both are the same magnitude -- the two are distinguishable in the model, and a comparison on magnitude alone cannot tell them apart. A quantity keeps the whitespace between its value and its unit, and the preposition that trailed it, leading space and all. A quoted description keeps its parens, commas, and `%` verbatim.

Where a canonical handle is useful it rides alongside the authored form:

| authored                | handle                              |
|-------------------------|-------------------------------------|
| `cloves`, as written    | `unitOfMeasureID: clove`            |
| the number as drawn     | the base value, serialised whole    |
| `[Dough](pizza-dough)`  | `targetSlug: pizza-dough`           |

Both are carried and neither replaces the other: one is what renders, the other is the handle a consumer looks up, converts with, or resolves. A consumer that converts a unit before scaling needs both together, so both ride the ingredient.

Because nothing is replaced, the rendered DOM carries back to the markdown it came from. A compiler could be written to reconstruct the `.md` from the card. Nothing here does that; it is the shape of a card that discards nothing.

## Edges

Edges run inside a card and out of it. Inside, they are what the graph is made of; outward, they reach another card, and that is what makes a box of cards a collection rather than a pile.

Within one card, the nodes nothing else reaches are where it is entered, and everything else is reached through them. A node reached from two places is one node, not a copy in each.

**An amount rides the edge, not the node.** A shared node is reached from more than one place and each use draws its own: a step may restate a measure, ask for what is left, or name the output with no amount at all. The ingredient carries the amount that exists; each reference carries what that line drew.

What is left of an ingredient after earlier draws is a question for a validator.  The reference exists so the graph has the edge, and the wording exists so the card reads as written.

**A cross-file edge is a slug.** A card is whole whether or not its target exists, which is what lets a collection be assembled one card at a time: a dough shared by nine recipes is one card the nine link to. The link carries the slug and the link text; a consumer resolves it into whatever it needs -- an anchor on the page, a route, an external URL. An unresolved reference is a legitimate state, the same way a hyperlink is.

The cards and those edges are the forest. A collection is not a container of cards; the edges between them are what ties it together.

## Layout

The card is flexbox. A step is a row holding what feeds it on the left and its own action on the right; the things feeding it are a column, and the step sits beside the whole stack rather than beside any one of them. That nesting is the layout, and it is why there is no arithmetic anywhere in the build: a box is as wide as its contents and the space its parent gives it, and the browser resolves the rest.

Two passes build it.

### Shape

The first pass answers what nests inside what, and on which side. It emits no tags, no text, no bindings -- only the boxes.

It is a separate pass because a single bottom-up recursion cannot express card-level facts. A node visited on the way up knows what lies under it and nothing else: not which column it shares with its siblings, not what sits to its right, not where a region begins. Those are facts about the whole card, so they need a stage where the whole card is in hand.

Three steps, two of which walk the DAG:

**Collect** finds where the card is entered. A node the card reaches from somewhere else is drawn at that use site, so what is left over -- the nodes nothing reaches -- is where the card begins. Two kinds of reach count: a reference edge, and a use site naming a declared cross-file link. The second carries no edge of its own, because a bare markdown link is self-naming and has no label to bind, so it is matched by name.

**Build** descends from each of those, making a box for every node it arrives at and every grouping the layout needs that the model has no node for: the column holding a step's inputs, and the body of a sub-recipe region. Arriving at a shared node twice makes a box at each use site -- one node in the graph, drawn wherever it is used. A reference makes a box of its own around the node it transcludes, and that box is where the draw the use site made lives.

**Relate** fills in what each box touches, reading the finished boxes rather than the DAG. Adjacency is sibling order within a parent, and a box's siblings do not exist while it is being built, which is why it is its own step. A box at either end of its parent's children touches nothing on that side: its edge is the parent's edge, which is what makes a border there the boundary of the group rather than a line between two of its members.

Each box carries what it is to its parent (`side`: inputs, action, header, body, root), how it lays its own children out (`flow`: row, column, leaf), the regions containing it, and what it touches. There are no coordinates -- the nesting already places it.

### Structure

The second pass fills those boxes with content: a tag, a part marker, the `data-*` bindings, the semantic HTML attributes a node sets, and the literal text of a leaf. It asks no structural question.

Dispatch is on the box rather than the model, `side` before node kind: a step's row box and its action leaf carry the same step, as do a sub-recipe's region box and its header. Children are always the box's children -- the model is never recursed into, because the shape pass already did that.

What comes out is every element the DOM needs, not a sketch of it -- including the inline pieces a box expands into: a quantity span, a marked span for each number that rescales, the literal text around them. A renderer turns this into elements and makes no structural decision of its own.

## DOM

The DOM stands on its own. Before any styling, it is plain `<div>`s that read as a recipe and are walkable by a screen reader -- semantic structure first, with markers and bindings riding along as attributes for a later CSS pass and a runtime binding.

Two prefixes, and the prefix says who reads it:

- `data-recipe-grid-<part>` -- a part marker, and the same prefix carries the machine-readable bindings: a scalable value, a unit key, a target slug. A consumer reads these.
- `recipe-grid-side`, `recipe-grid-flow`, `recipe-grid-edge` -- unprefixed. A rule matches on these and takes nothing away.

`side` and `flow` are what a rule targets a box by when the part marker is not enough: the inputs column and a region's body have no part of their own. A rule needing both which axis a line lies on and which end of it reads `flow` from the parent and `edge` from the child, so neither has to be recovered from the marker.

`edge` says which of a box's own edges are its container's rather than a line between it and a neighbour -- `start`, `end`, `both`, or absent when the box has a neighbour on each side. It is what a border bounds a group with instead of dividing two of its members.

The headless stylesheet is flow only: which way a box lays its children out, and how it takes space from its parent. An inputs column asks for what its contents need and gives back last; the action beside it takes what is left. Both carry `min-width: 0`, and so does the content inside a leaf box -- a flex item's own minimum is its longest unbreakable word, and a card is steps inside inputs columns inside steps, so each level's floor is built from the level below. Both must yield for the text to wrap.

A minimum width is a real decision about a particular card at a particular size, and it is the consumer's -- one rule on the boxes they choose. Colours, borders, spacing, and type are a theme's.

## API

```ts
parse(md: string): RecipeModel
```

Returns `{ title, description, meta, structure, root }`.

- `structure` is the render structure: part-tagged nodes a framework binding renders one node at a time.
- `root` is that same structure transported to elements: a serialisable DOM chunk to mount directly, for a consumer without a framework.
- `meta` is the recipe's own metadata -- its slug, and how it scales.

Both come from one pass, so a consumer takes whichever it needs.

One failure: the grammar is the gate. A body either reads as a valid DAG or the document is broken, so `parse` throws `RecipeParseError` and there is one place to catch it. Whether a well-formed recipe is a *sensible* recipe is a separate question, asked by a consumer that wants it.

The scaling metadata rides on the root of the card and the base values ride on the numbers, so a consumer scales the card by reading what is already there.  Converting units, rescaling, resolving a link, deciding a minimum width: each is a consumer's move, made with the handles the card carries.