# Recipe Markdown Format - Quick Reference

A recipe `.md` in this project is a **human-readable file that also encodes a Directed Acyclic Graph (DAG)**. It reads as a plain recipe and is also source the `recipe-grid` parser reads. The readable form and the DAG are the same thing: the `.md` does not describe a graph, it is one, written so a person can read it.

The one property that makes it a DAG (not a tree): a name declared once can be **referenced** by later lines, so a single node has more than one parent. That shared-node back-edge is the whole distinction.

---

## YAML frontmatter (recipe-level metadata)

A `---`-fenced YAML block at the top of the file, split off before the body is lexed. Declares how the recipe scales; applied at runtime.

| key           | values                     | note                                  |
|---------------|----------------------------|---------------------------------------|
| `scalingType` | `servings` \| `fixed`      | required when frontmatter is present  |
| `base`        | number                     | base to scale from; default `1`       |
| `unitSystem`  | `us` \| `imperial` \| `metric` | measurement system; default `us`  |
| `slug`        | string                     | recipe id; defaults to a slug of the title  |

Absent frontmatter defaults to `{ scalingType: 'fixed', base: 1, unitSystem: 'us' }`, so a recipe with no metadata is still valid. `servings` scales at 1/2x / 1x / 2x of `base`; `fixed` does not scale.

---

## Recipe header (title, description)

Between the frontmatter and the body: the human-facing header. Neither is part
of the DAG.

| md surface            | produces      |
|-----------------------|---------------|
| the recipe heading    | `title`       |
| prose after the title | `description` |

---

## Body constructs (surface -> model node)

The body is an indented block. Each construct maps to a model node:

| md surface                    | produces (model node)              | note                                                     |
|-------------------------------|------------------------------------|----------------------------------------------------------|
| `2 tsp honey`                 | `Ingredient` {quantity, description} | a quantity line; a leaf node                            |
| `honey, whipped`              | `Step` {inputs}                    | a quantity line **with a trailing action** -> a Step     |
| `label = value`               | the node the `value` produces, carrying `label` | binds a `label` (the identifier later references resolve to) to the produced node (`Ingredient`, or `Step` if the value has a trailing action). The `label` rides on that produced node and **drives its output markup** (e.g. `red peppers = 150g ..., finely chopped` -> label `red peppers` on the **Step**) |
| `[Dough](pizza-dough)`        | `RecipeReference` {targetSlug}     | **cross-file** reference; the sibling/alternative to `label` -- a bare markdown link, self-naming so no `=`. Binds an ingredient or step to an external recipe (href = target slug; link text = the local name later lines resolve to). A pointer; the target may not exist |
| `Foo :=` heading              | `SubRecipe` {outputNames}          | a named region; its title row spans whatever it contains (steps, ingredients, nested sub-recipes; no restriction), and its output is referenced by later lines |
| `action(a, b)` / `x, action`  | `Step` {inputs}                    | the combiner                                             |
| bare later use of a label     | `Reference` {resolvedNode ->}      | **the back-edge that makes it a DAG**                    |
| `{N}`                         | `InterpolatedValue`                | scalable number inside a description                     |

The load-bearing row is **`Reference -> resolvedNode`**: it points at an already-declared node, giving that node a second parent, a graph edge rather than a tree branch. That single mechanism is why the file is a DAG.

### String handling

A description can be naked or quoted. Quoting is a literal escape hatch:

| md surface                        | parsed as                                | note                                                          |
|-----------------------------------|------------------------------------------|---------------------------------------------------------------|
| `plain flour`                     | naked description text                   | default; parsed normally                                      |
| `"plain flour (12% protein)"`     | literal description, captured raw        | `"..."` / `'...'` content is **not** parsed for quantity/unit; `%`, parens, commas preserved verbatim |

This is what keeps a value bound as a `Quantity` separate from literal text on
the same line: in `200g "plain flour (12% protein)"`, the `200g` binds as the
`Quantity` (value 200, unit `g`) and the quoted string is the raw `description`,
so `12%` stays description; it is never read as a value.

---

## Encodings

The same graph, in several forms. Each step **adds**; none rewrites or discards, which is why a `.md` could be generated from a DOM.

| form              | is                        | the step into it adds                                                  |
|-------------------|---------------------------|------------------------------------------------------------------------|
| `.md`             | the graph, human-readable | --                                                                     |
| AST (PEG/Peggy)   | the graph, parsed         | nothing; the grammar is the gate -- it reads or the recipe is broken   |
| DAG model         | the graph, typed          | node types, pre-shaped for the walk                                    |
| `structure`       | the graph, bound          | data / structure / styling targets (+ headless CSS)                    |
| `root`            | `structure`, mountable    | nothing; a DOM chunk derived from `structure`                          |

`structure` is the one API surface -- what a framework binding renders against.  `root` comes off it directly, a mountable DOM chunk for consumers without a framework; there is no second surface to drift from the first.

There is no tree at any point, and no stage where the graph is built -- it is present from the `.md` on.

Validation is a separate pass, off the render path. It asks whether a *recipe* is sensible -- not whether the graph is well-formed, which the grammar already settled.
