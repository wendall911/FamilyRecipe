/**
 * Recipe Grid model — the object model / data structure for a parsed recipe.
 *
 * This is a **superset** of the Recipe Grid 2 semantic model (mossblaser's
 * `recipe_grid`, ported from `recipe_grid/recipe.py`). It aims for full
 * fidelity with that model, then adds FamilyRecipe-specific extensions.
 *
 * Provenance is tagged per declaration:
 *   [G2]  — faithful to Recipe Grid 2 (recipe_grid, GPL-family; AGPL-compatible).
 *   [EXT] — FamilyRecipe extension, not present in Recipe Grid 2.
 *
 * NOTE ON TYPES: TypeScript here is *decorative* — erased at compile time.
 * These types describe the shape of plain JS objects; they enforce nothing at
 * runtime. Grid 2's invariants (e.g. a Reference may only target a prior
 * SubRecipe root; multi-output SubRecipes may only be tree roots) are NOT
 * expressible as types and must live in a separate runtime constraint layer
 * (next design step). Discriminated unions use a `kind` tag purely for
 * runtime dispatch.
 *
 * NOTE ON REFERENCES: a reference is a pointer, not a guarantee. A reference to
 * a target that does not exist is still a valid reference (like a hyperlink to a
 * 404). Nothing here resolves or validates target existence.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Numeric value
// ─────────────────────────────────────────────────────────────────────────────

/**
 * [G2] A recipe numeric value. Grid 2 uses `int | float | Fraction`, where
 * `Fraction` is *exact* (¼ tsp stays ¼, never 0.25). JS `number` cannot
 * represent exact fractions, so exact values are held as a {@link Fraction}.
 * The concrete arithmetic/formatting is handled by a dedicated value handler
 * (a fraction library), not by this type.
 */
export type RecipeNumber = number | Fraction;

/** [G2] An exact rational value (numerator / denominator). */
export type Fraction = {
  numerator: number;
  denominator: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// Scale-aware string
// ─────────────────────────────────────────────────────────────────────────────

/**
 * [G2] A string whose embedded numbers rescale with the recipe while literal
 * text does not. Represented as an ordered list of parts:
 *
 *   ["divide into ", 8, " burgers about 10cm in diameter"]
 *
 * On scale(×2) the `8` becomes `16`; the "10cm" text is untouched. Normalized
 * form: adjacent strings merged, empty strings dropped. Used for every
 * description / step name / output name in the model.
 */
export type ScaledValueStringPart = string | RecipeNumber;
export type ScaledValueString = ScaledValueStringPart[];

// ─────────────────────────────────────────────────────────────────────────────
// Amounts: Quantity and Proportion
// ─────────────────────────────────────────────────────────────────────────────

/**
 * [G2] An absolute quantity, e.g. "50g of", "3 apples".
 * Suggested rendering:
 *   value + (valueUnitSpacing + unit if unit != null) + preposition
 */
export type Quantity = {
  kind: "quantity";
  /** [G2] The amount. */
  value: RecipeNumber;
  /** [G2] Unit name, or null for a unit-less count (e.g. 3 apples). */
  unit: string | null;
  /** [G2] Whitespace between value and unit; "" when there is no unit. */
  valueUnitSpacing: string;
  /** [G2] Trailing preposition incl. leading space, e.g. " of" in "50g of". */
  preposition: string;
};

/**
 * [EXT] "Use whatever is left" of a referenced output — a bare marker, not a
 * computed proportion. Diverges from Grid 2's numeric Proportion (percent /
 * multiplier / fractional value): the published Grid 2 recipe corpus never uses
 * numeric proportions, and real recipes only ever say "use the rest later". It
 * carries no value — the ingredient list is the definitive amount; ingredient
 * consumption is an editor validation concern, not the parser's. Appears once,
 * at an ingredient's final use, drawn as a back-reference in the overview.
 */
export type Remainder = {
  kind: "remainder";
  /** [EXT] The wording used (e.g. "remaining", "rest"), for display. */
  wording: string;
  /**
   * [EXT] Trailing preposition incl. leading space, e.g. " of the" in "rest of
   * the sauce". Retained (not discarded) so a later editor/validator can check
   * the authored wording against the ingredient list.
   */
  preposition: string;
};

/** [G2] The amount of a referenced output to use: an absolute amount or the rest. */
export type Amount = Quantity | Remainder;

// ─────────────────────────────────────────────────────────────────────────────
// Recipe tree nodes (a DAG when references/sub-recipes are shared)
// ─────────────────────────────────────────────────────────────────────────────

/** [G2] Any node in a recipe tree. */
export type RecipeTreeNode = Ingredient | Step | SubRecipe | Reference | RecipeReference;
//                                                                       ^^^^^^^^^^^^^^^ [EXT]

/** [G2] A leaf node: an ingredient to be used. */
export type Ingredient = {
  kind: "ingredient";
  /** [G2] Description of the ingredient (scale-aware). */
  description: ScaledValueString;
  /** [G2] Quantity, or null if quantity-less. */
  quantity: Quantity | null;
  /**
   * [G2] The author's recipe-local mapping label from an `ingredient = X`
   * binding — the handle later lines reference. Never surfaces as display
   * (the description is what shows); distinct from a canonical schema key
   * (see identity.canonicalName), since a shorthand label may not be canonical.
   */
  label?: string;
  /** [EXT] Optional structured/canonical identity for schema mapping. */
  identity?: IngredientIdentity;
};

/** [G2] A step: a description plus the inputs (children) being combined. */
export type Step = {
  kind: "step";
  /** [G2] What to do (scale-aware), e.g. "mix". */
  description: ScaledValueString;
  /** [G2] Inputs to this step: ingredients, other steps, or references. */
  inputs: RecipeTreeNode[];
  /**
   * [G2] The author's recipe-local mapping label from an `ingredient = X`
   * binding, when the labeled node is a step (`X, some action`). The handle
   * later lines reference. Never surfaces as display; distinct from a canonical
   * schema key. See {@link Ingredient.label}.
   */
  label?: string;
};

/**
 * [G2] A named logical division of a recipe (e.g. "Filling", "Pastry").
 * Exactly one child tree; one or more named outputs. A SubRecipe with more
 * than one output must be the root of a recipe tree (runtime invariant).
 */
export type SubRecipe = {
  kind: "subRecipe";
  /** [G2] The steps describing this sub-recipe. */
  subTree: RecipeTreeNode;
  /** [G2] One or more output names (scale-aware). >1 ⇒ must be a tree root. */
  outputNames: ScaledValueString[];
};

/**
 * [G2] An **intra-document** reference: a back-pointer to a labelled node earlier
 * in the same {@link Recipe} (or its `follows` chain). Grid 2's own reuse
 * mechanism only referenced a {@link SubRecipe} output.
 *
 * [EXT] FamilyRecipe generalises the target to *any* {@link RecipeTreeNode}, so a
 * reference can also resolve to an `=`-labelled {@link Ingredient} or {@link Step}
 * — not just a `:=` {@link SubRecipe}. `resolvedNode` is a real object pointer
 * (the DAG is cyclic when nodes are shared); it is distinct from
 * {@link RecipeReference}, which is the *cross-file* link.
 */
export type Reference = {
  kind: "reference";
  /**
   * [EXT] The in-document node this reference resolves to (Ingredient, Step, or
   * SubRecipe). A pointer, not a copy.
   */
  resolvedNode: RecipeTreeNode;
  /**
   * [G2] Which named output of a multi-output {@link SubRecipe} target (default
   * 0). Absent when the target is not a SubRecipe (an Ingredient/Step has a
   * single result).
   */
  outputIndex?: number;
  /** [G2] How much of the output to use; absent means all of it. */
  amount?: Amount;
};

// ─────────────────────────────────────────────────────────────────────────────
// Recipe container
// ─────────────────────────────────────────────────────────────────────────────

/**
 * [G2] A recipe: a series of recipe trees. Later trees may reference outputs of
 * earlier trees (a DAG). Multi-section recipes chain via `follows`, and
 * references may resolve backward across that chain.
 */
/**
 * [EXT] How a recipe scales. Grid 2 has no scaling metadata (it inferred a
 * serving count from the title); this is a FamilyRecipe divergence. Declared in
 * the recipe's YAML frontmatter and read by the markdown layer. This type is
 * the single source of truth for that shape — the markdown layer references it.
 * A recipe with no frontmatter is 'fixed', base 1 — matching Grid 2 recipes.
 */
export type RecipeScaling = {
  /** [EXT] How this recipe scales. Absent frontmatter defaults to 'fixed'. */
  scalingType: "servings" | "fixed";
  /**
   * [EXT] The as-authored base to scale from. For 'servings' it is the base
   * serving count (e.g. 2). Absent frontmatter defaults to 1.
   */
  base?: RecipeNumber;
};

export type Recipe = {
  /** [G2] The recipe tree roots. */
  recipeTrees: RecipeTreeNode[];
  /** [G2] Prior recipe section this one follows, or null. */
  follows: Recipe | null;
  /** [EXT] This recipe's own identity, for cross-file references (see below). */
  slug?: string;
} & RecipeScaling;

// ─────────────────────────────────────────────────────────────────────────────
// FamilyRecipe extensions [EXT]
// ─────────────────────────────────────────────────────────────────────────────

/**
 * [EXT] A **cross-file** reference to another recipe by identity (slug).
 *
 * Distinct from {@link Reference}, which targets a SubRecipe *object* within
 * the same document. This models the real-world case where a base recipe
 * (e.g. a roux) is shared across many separate recipe files.
 *
 * It is a pointer only: the target may not exist. Resolution (looking up the
 * title, rendering a link, showing "not found") is a concern of the site/index
 * layer, not this model — and a dangling reference is still valid.
 */
export type RecipeReference = {
  kind: "recipeReference";
  /** [EXT] Identity (slug) of the target recipe file. */
  targetSlug: string;
  /** [EXT] Which named output of the target, if it has several. */
  outputName?: ScaledValueString;
  /** [EXT] How much of the target to use, if specified. */
  amount?: Amount;
  /**
   * [G2] The author's recipe-local mapping label from an `ingredient = X`
   * binding, when the labeled node is a cross-recipe link. The handle later
   * lines reference. Never surfaces as display; distinct from a canonical
   * schema key. See {@link Ingredient.label}.
   */
  label?: string;
};

/**
 * [EXT] Structured/canonical ingredient identity.
 *
 * Grid 2's {@link Ingredient} carries only a scale-aware description string.
 * This optional structure adds a canonical identity for typed ingredients and
 * later schema.org / allergen / category mapping.
 */
export type IngredientIdentity = {
  /** [EXT] Normalized canonical key, e.g. "all-purpose-flour". */
  canonicalName?: string;
  // Room to grow: schemaOrg mapping, allergens, category, substitutions, …
};
