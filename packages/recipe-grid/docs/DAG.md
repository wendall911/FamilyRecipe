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

A `Quantity` carries `value`, `unitOfMeasure`, `unitOfMeasureID`, `valueUnitSpacing`, and `preposition`.

`value` is a `RecipeNumber`: a JS number for a whole number or a decimal, or a `Fraction` (`numerator`/`denominator`) for an exact fraction. The authored form is what is kept -- `1/2` stays a fraction and `0.5` stays a decimal, though both resolve to the same magnitude.

`unitOfMeasure` is the unit name as authored, or `null` for a unit-less count.  `unitOfMeasureID` is the canonical `unitsOfMeasure` key that name resolves to (`cloves` -> `clove`, `g` -> `gram`), or `null` when the authored unit is. Both are carried: one is what renders, the other is the handle a consumer looks up with. Neither replaces the other.

### SubRecipe

A `:=` heading compiles to a `subRecipe`. Its `outputNames` holds the declared names, each a `ScaledValueString`; its `subTree` is the single child tree the heading bound, typically the step whose arguments are the region's inputs. Output names are matched as text, trimmed and lowercased, so a later line reaches an output whatever case it was authored in.

A later line that resolves a name compiles to a `reference`. Its `resolvedNode` is the node that name was bound to -- the object itself, not a copy. The target is any node the author labelled: a `:=` sub-recipe, or an `=`-labelled ingredient or step. `outputIndex` names which output of a multi-output sub-recipe is meant, and is absent when the target is not a sub-recipe, since an ingredient or a step has a single result.

A reference's `amount` is what that line drew, carried on the edge rather than the node it targets: a `Quantity` when the line restated a measure, a `Remainder` when it asked for what is left, and absent when the line named the output with no amount at all. A shared node is reached from more than one place and each use draws its own, so the amount cannot live on the node.

### Recipe

The container the rest hangs from. `recipeTrees` holds the roots the body declared -- every top-level line, including the ones nothing goes on to reference. A node that no later line reaches is a root like any other; whether that is an authoring mistake is a question for a validator, not something the compiler decides.

`slug` is the recipe's own identity: the authored frontmatter value, or one derived from the title when none was authored. It is always a concrete string, since a cross-file `recipeReference` resolves against it.

The recipe carries its scaling as authored: `scalingType` is `servings` or `fixed`, `base` is the value to scale from, and `unitSystem` is the measurement system the quantities are read in -- `us`, `imperial`, or `metric`. A recipe with no frontmatter is `fixed`, base 1, `us`.

A `Remainder` is the last draw on an ingredient, and appears on a `reference` inside a step rather than on the ingredient node itself. It carries `wording` -- the text as authored, which is what the card draws -- and a `preposition` when the line trailed one. It holds no value: the ingredient node carries the amount that exists, and what is left of it after earlier draws is a validation question. The reference exists so the graph has the edge; the wording exists so the card reads as written.
