# DAG

What the compiler builds from the AST. The stage between the AST and the render structure: `markdown -> AST -> DAG model`.

This document describes what each model node is: its fields and what they hold.

The compiled recipe is a directed acyclic graph, not a tree. A node declared once can be reached from more than one place: a later line that resolves a name compiles to a `reference` whose `resolvedNode` is that same object, not a copy of it. Anything that serialises this model as a tree will emit a shared node once and mark the rest as circular.

## Node types

### Ingredients

An AST `reference` entry compiles to an `ingredient`. Its `description` is a `ScaledValueString`: an ordered list of literal strings and embedded numbers, normalised so adjacent strings are merged and empty strings dropped. A quoted name arrives as one string part with its parens, commas, and `%` intact. A `{N}` arrives as a number part among the literal text, and produces no quantity.

Its `quantity` is a `Quantity` or `null`.

An AST `externalReference` compiles to a `recipeReference`. It carries `name` (the link text, and the handle later lines resolve to), `targetSlug` (the target recipe's identity), and `title` when the link has one. It is a pointer only: the target may not exist.

An entry with a trailing action compiles to a `step` wrapping the node the action followed, as that step's single input. The step's `description` is the action text.

A `label` sits on the node the author bound it to -- the step, when the entry has a trailing action. It is the handle later lines resolve against, and the text drawn where a reference to that node appears. It does not replace the description: the node under a labelled step keeps its own and takes no label of its own.

### Quantities

A `Quantity` carries `value`, `unitOfMeasure`, `unitOfMeasureID`, `valueUnitSpacing`, and `preposition`.

`value` is a `RecipeNumber`: a JS number for a whole number or a decimal, or a `Fraction` (`numerator`/`denominator`) for an exact fraction. The authored form is what is kept -- `1/2` stays a fraction and `0.5` stays a decimal, though both resolve to the same magnitude.

`unitOfMeasure` is the unit name as authored, or `null` for a unit-less count.  `unitOfMeasureID` is the canonical `unitsOfMeasure` key that name resolves to (`cloves` -> `clove`, `g` -> `gram`), or `null` when the authored unit is. Both are carried: one is what renders, the other is the handle a consumer looks up with. Neither replaces the other.

### SubRecipe

### Recipe
