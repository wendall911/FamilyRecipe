# AST

What the Peggy grammar emits. The stage between the recipe `.md` and the DAG: `markdown -> AST -> DAG model`.

This document describes what each AST node is: its fields and what they hold. It does not describe what markdown produces a given node. The grammar (`src/grammar.peggy`) states that directly and is the only source for it.

Audience: tooling and downstream implementors.

## Node types

### Ingredients

Three node kinds appear as ingredient entries. They read alike on a card and are different in the AST.

**An ingredient** is a `reference`. Its `name` is a `string`; its `amount` is a `quantity`, a `remainder`, or `null`.

**An ingredient with an action** is a `step`. The step's `name` is the action text and the ingredient is its single input. A `label` sits on the step; the `amount` stays on the input.

**A link to another recipe** is an `externalReference`. Its `name`, `targetSlug`, and `title` are plain strings rather than `string` nodes. It has no `label`, since the link text is the name. `title` is absent when the link has none.

An `externalReference` can be a step's input, the same way a `reference` can.

A `reference`'s `name` is a `string`: a list of `substring` parts and `interpolatedValue` parts. An `interpolatedValue` is a number that scales with the recipe. A quoted name is a literal — its content is not parsed for quantity or unit, so parens, commas, and `%` inside it stay in the name. A `{N}` in a name becomes an `interpolatedValue` among that name's substrings and produces no amount.

A `quantity` carries `value` and `parts`. `value` holds what was authored: a whole number and a decimal are both JS numbers, and an exact fraction is `numerator`/`denominator` rather than a decimal. `parts` holds the pieces that followed the value, in order — the unit and the preposition when the author wrote them, each a `quantityPart` with the `leading` content that preceded it and its `text` as a `string`. `leading` is empty when a piece abuts what came before it, and `parts` is empty on a bare count.

### SubRecipe

`:=` marks a statement named: `named` is true and `outputs` holds the declared name. The statement's `expr` is the `step` it wraps, and the arguments in that step's parens are its `inputs`, in the order authored.

A step's input may itself be a step, so steps nest recursively.

### Recipe

A `reference`'s `amount` is a `quantity` or a `remainder`. An ingredient list entry never carries a remainder; a `remainder` appears on a `reference` inside a step. Its `wording` is preserved as authored.
