# Recipe Markdown Format - Quick Reference

A recipe `.md` in this project is a **human-readable file that also encodes a
Directed Acyclic Graph (DAG)**. It reads as a plain recipe and is also source
that the `recipe-grid` parser compiles: `markdown -> AST (PEG/Peggy) -> DAG
model`. The readable form and the DAG are the same thing; the DAG is what the
compiler extracts from the readable form.

The one property that makes it a DAG (not a tree): a name declared once can be
**referenced** by later lines, so a single node has more than one parent. That
shared-node back-edge is the whole distinction.

---

## 1. YAML frontmatter (recipe-level metadata)

A `---`-fenced YAML block at the top of the file, split off before the body is
lexed. Declares how the recipe scales; applied at runtime.

| key           | values                     | note                                  |
|---------------|----------------------------|---------------------------------------|
| `scalingType` | `servings` \| `fixed`      | required when frontmatter is present  |
| `base`        | number                     | base to scale from; default `1`       |

Absent frontmatter defaults to `{ scalingType: 'fixed', base: 1 }`, so a recipe
with no metadata is still valid. `servings` scales at 1/2x / 1x / 2x of `base`;
`fixed` does not scale.

---

## 2. Body constructs (surface -> model node)

The body is an indented block. Each construct maps to a model node:

| md surface                    | produces (model node)              | note                                                     |
|-------------------------------|------------------------------------|----------------------------------------------------------|
| `2 tsp honey`                 | `Ingredient` {quantity, description} | a quantity line; a leaf node                            |
| `honey, whipped`              | `Step` {inputs}                    | a quantity line **with a trailing action** -> a Step     |
| `label = value`               | the node the `value` produces, carrying `label` | binds a `label` (the identifier later references resolve to) to the produced node (`Ingredient`, or `Step` if the value has a trailing action). The `label` rides on that produced node and **drives its output markup** (e.g. `red peppers = 150g ..., finely chopped` -> label `red peppers` on the **Step**) |
| `Foo :=` heading              | `SubRecipe` {outputNames}          | a named region; its title row spans whatever it contains (steps, ingredients, nested sub-recipes; no restriction), and its output is referenced by later lines |
| `action(a, b)` / `x, action`  | `Step` {inputs}                    | the combiner                                             |
| bare later use of a label     | `Reference` {resolvedNode ->}      | **the back-edge that makes it a DAG**                    |
| `{N}`                         | `InterpolatedValue`                | scalable number inside a description                     |

The load-bearing row is **`Reference -> resolvedNode`**: it points at an
already-declared node, giving that node a second parent, a graph edge rather
than a tree branch. That single mechanism is why the file is a DAG.

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

## 3. Pipeline

```
markdown -> AST (PEG/Peggy) -> DAG model -> walk -> render structure (DOM + headless CSS)
```

The `.md` is fed to the compiler in `recipe-grid`; the DAG is the internal model;
the render structure is walked out of it. Validation is a separate concern (a
distinct pass), not part of the render path.
