# AST

What the Peggy grammar emits. The stage between the recipe `.md` and the DAG: `markdown -> AST -> DAG model`.

This document describes what each AST node is: its fields and what they hold. It does not describe what markdown produces a given node. The grammar (`src/grammar.peggy`) states that directly and is the only source for it.

Audience: tooling and downstream implementors.

## Node types

### Ingredient list entries

Three node kinds appear as entries in a recipe's ingredient list. They read alike on a card and are different in the AST.

**An ingredient** is a `reference`. Its `name` is a `string`; its `amount` is a `quantity`, a `remainder`, or `null`.

**An ingredient with an action** is a `step`. The step's `name` is the action text and the ingredient is its single input. A `label` sits on the step; the `amount` stays on the input.

**A link to another recipe** is an `externalReference`. Its `name`, `targetSlug`, and `title` are plain strings rather than `string` nodes. It has no `label`, since the link text is the name. `title` is absent when the link has none.

An `externalReference` can be a step's input, the same way a `reference` can.
