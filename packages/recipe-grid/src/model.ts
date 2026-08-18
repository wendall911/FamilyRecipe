/**
 * Recipe Grid model - the object model / data structure for a parsed recipe.
 *
 * A divergent port of the Recipe Grid 2 semantic model: faithful where the two
 * agree, deliberately different where this project's goals differ.
 *
 * Provenance is tagged per declaration:
 *   [G2] - faithful to Recipe Grid 2.
 *   [EXT] - a recipe-grid extension, not present in Recipe Grid 2.
 *
 * NOTE ON TYPES: types are erased at compile time and check nothing at
 * runtime. An invalid recipe breaks; validation is a validation compiler's job.
 *
 * NOTE ON REFERENCES: a reference is a pointer, not a guarantee; a reference
 * to a non-existent target is still valid (like a hyperlink to a 404).
 * Resolution/validation happens elsewhere, not here.
 */

/**
 * [G2] A recipe numeric value.
 */
export type RecipeNumber = number | Fraction;

/**
 * [G2] An exact rational value (numerator / denominator).
 */
export type Fraction = {
    numerator: number;
    denominator: number;
};

/**
 * [G2] A string whose embedded numbers rescale with the recipe while literal
 * text does not. Represented as an ordered list of parts:
 *
 *   ["divide into ", 8, "burgers about 10cm in diameter"]
 *
 * On scale(×2) the `8` becomes `16`; the "10cm" text is untouched. Normalized
 * form: adjacent strings merged, empty strings dropped. Used for every
 * description / step name / output name in the model.
 */
export type ScaledValueStringPart = string | RecipeNumber;
export type ScaledValueString = ScaledValueStringPart[];

/**
 * [EXT] A piece of an amount as authored, with the content that preceded it.
 *
 * Every piece of an ingredient is drawn as its own element, so nothing sits
 * between two of them: each carries what led it. `leading` is what the grammar
 * matched before this piece, empty when the piece abuts what came before.
 */
export type QuantityPart = {
    kind: "quantityPart";
    // What preceded this piece, or "" when it abuts what came before.
    leading: string;
    // The piece as authored, e.g. "cloves", "of the".
    text: string;
    /**
     * Present when this piece is a unit name -- the vocabulary claimed
     * its text. The canonical key it resolves to rides on the
     * {@link Quantity}; this says only which piece carries the name.
     */
    isUnitName?: boolean;
};

/**
 * [G2] An absolute quantity, e.g. "50g of", "3 apples": its value, then the
 * pieces that followed it, in order. Also carries the canonical unit
 * identity, so a consumer can convert without re-matching a string the grammar
 * already matched.
 */
export type Quantity = {
    kind: "quantity";
    // [G2] The amount.
    value: RecipeNumber;
    /**
     * [EXT] The pieces that followed the value -- the unit and the preposition
     * when the author wrote them, in order, each with what preceded it. Empty
     * for a unit-less count (e.g. 3 apples).
     */
    parts: QuantityPart[];
    /**
     * [EXT] The canonical unit key the authored unit resolves to -- the
     * parse-ingredient `unitsOfMeasure` record key ("cloves" -> "clove",
     * "g" -> "gram"). Carried alongside the authored unit, never instead of it:
     * one is what the author wrote and what renders, the other is the handle a
     * consumer looks up. Null when no piece is a unit name. A quantity whose
     * author wrote more than one unit carries the last -- which is what they
     * wrote; whether it is a sensible recipe is a validator's question.
     */
    unitOfMeasureID: string | null;
};

/**
 * [EXT] "Use whatever is left" of a referenced output as a bare marker, not a
 * computed proportion. Appears once, at an ingredient's final use.
 */
export type Remainder = {
    kind: "remainder";
    // The wording used (e.g. "remaining", "rest"), for display.
    wording: string;
    /**
     * Trailing preposition incl. leading space, e.g. " of the" in "rest of
     * the sauce". Retained (not discarded) so a later validator can check
     * the authored wording against the ingredient list.
     */
    preposition: string;
};

/**
 * [G2] The amount of a referenced output.
 */
export type Amount = Quantity | Remainder;

/**
 * [G2] Any node in a recipe tree.
 */
export type RecipeTreeNode = Ingredient | Step | SubRecipe | Reference | RecipeReference;

/**
 * [G2] A leaf node: an ingredient to be used.
 */
export type Ingredient = {
    kind: "ingredient";
    // [G2] Description of the ingredient (scale-aware).
    description: ScaledValueString;
    // [G2] Quantity, or null if quantity-less.
    quantity: Quantity | null;
    /**
     * [EXT] The author's recipe-local mapping label from an `ingredient = X`
     * binding -- the handle later lines reference, and the text drawn where a
     * reference to this node appears. It does not replace the description, which
     * is what this node itself shows. Distinct from a canonical schema key (see
     * identity.canonicalName), since a shorthand label may not be canonical.
     */
    label?: string;
    // [EXT] Optional structured/canonical identity for schema mapping.
    identity?: IngredientIdentity;
};

/**
 * [G2] A step: a description plus the inputs (children) being combined.
 */
export type Step = {
    kind: "step";
    // [G2] What to do (scale-aware), e.g. "mix".
    description: ScaledValueString;
    // [G2] Inputs to this step: ingredients, other steps, or references.
    inputs: RecipeTreeNode[];
    /**
     * [EXT] The author's recipe-local mapping label from an `ingredient = X`
     * binding, when the labeled node is a step (`X, some action`). The handle
     * later lines reference. Never surfaces as display; distinct from a canonical
     * schema key. See {@link Ingredient.label}.
     */
    label?: string;
};

/**
 * [G2] A named logical division of a recipe (e.g. "Filling", "Pastry").
 * Exactly one child tree, exactly one output name.
 */
export type SubRecipe = {
    kind: "subRecipe";
    // [G2] The steps describing this sub-recipe.
    subTree: RecipeTreeNode;
    /**
     * [G2] The output name (scale-aware) later lines resolve against. Always
     * [0]; the array shape is Grid 2's, and nothing writes past it.
     */
    outputNames: ScaledValueString[];
};

/**
 * [G2] An **intra-document** reference: a back-pointer to a labelled node earlier
 * in the same {@link Recipe}. Grid 2's own reuse mechanism only referenced a 
 * {@link SubRecipe} output.
 *
 * [EXT] Generalises the target to *any* {@link RecipeTreeNode}, so a
 * reference can also resolve to an `=`-labelled {@link Ingredient} or {@link Step}, 
 * not just a `:=` {@link SubRecipe}. `resolvedNode` is a real object pointer
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
     * [G2] Present when the target is a {@link SubRecipe}, absent otherwise. A
     * sub-recipe has one output, so it is always 0.
     */
    outputIndex?: number;
    /**
     * [EXT] How much of the target this use site draws: a {@link Quantity} when
     * the line restated a measure, a {@link Remainder} when it asked for what is
     * left, absent when it named the target and nothing more, which draws all of
     * it.
     *
     * It rides the edge, not the node: a shared node is reached from more than
     * one place and each use draws its own.
     */
    amount?: Amount;
};

/**
 * [EXT] How a recipe scales.Declared in the recipe's YAML frontmatter and read
 * by the markdown layer. A recipe with no frontmatter is 'fixed', base 1,
 * matching Grid 2 recipes.
 */
export type RecipeScaling = {
    // How this recipe scales. Absent frontmatter defaults to 'fixed'.
    scalingType: "servings" | "fixed";
    /**
     * The as-authored base to scale from. For 'servings' it is the base
     * serving count (e.g. 2). Absent frontmatter defaults to 1.
     */
    base?: RecipeNumber;
    /**
     * The measurement system the authored quantities are read in -- a
     * `parse-ingredient` UnitSystem value. Absent frontmatter defaults to 'us'.
     */
    unitSystem: "us" | "imperial" | "metric";
};

/**
 * [EXT] Recipe-level metadata, resolved by the markdown/extraction layer and
 * handed to the compiler as one bundle; the compiler stamps the relevant fields
 * onto the {@link Recipe}.
 */
export type RecipeMeta = RecipeScaling & {
    /**
     * The recipe id: the authored frontmatter value if present, else a slug
     * derived from the title.
     */
    slug: string;
};

/**
 * A recipe with a series of recipe trees that later reference the output of
 * earlier tress resulting in a Directed Acrylic Graph (DAG) structure that
 * describes the recipe.
*/

export type Recipe = {
    // [G2] The recipe tree roots.
    recipeTrees: RecipeTreeNode[];
    /**
     * [EXT] This recipe's own identity (the recipe id), for cross-file references
     * (see below). Always resolved by the extraction layer (authored in
     * frontmatter, else derived from the title) and stamped by the compiler, so
     * it is always present on a compiled Recipe.
     */
    slug: string;
} & RecipeScaling;

/**
 * [EXT] A **cross-file** reference to another recipe by identity (slug).
 *
 * Distinct from {@link Reference}, which targets a SubRecipe *object* within
 * the same document. This models the real-world case where a base recipe
 * (e.g. dough) is shared across many separate recipe files.
 *
 * It is a pointer only: the target may not exist. Resolution (looking up the
 * title, rendering a link, showing 404 - "not found") is a concern of the
 * site/index layer, not this model. A dangling reference is still valid.
 */
export type RecipeReference = {
    kind: "recipeReference";
    /**
     * The link text: both the displayed name and the handle later lines
     * resolve to. A bare markdown link is self-defining, so there is no separate
     * `label` (which exists elsewhere only to give a node an internal id distinct
     * from its display text, which a split this node does not have).
     */
    name: string;
    // Identity (slug) of the target recipe file — the link destination.
    targetSlug: string;
    /**
     * The markdown link title (the third `[text](slug "title")` token), when
     * authored. Carried through the DAG so the render side constructs the
     * `<a title="...">`. Optional: a bare link has none.
     */
    title?: string;
    /*
     * The authored number of the external recipe reference needed. This allows for
     * correct scaling if the author needs fractional or number values here.
     */
    amount?: RecipeNumber;
};

/**
 * [EXT] Structured/canonical ingredient identity.
 *
 * This optional structure adds a canonical identity for typed ingredients and
 * later possibly schema.org / allergen / category mapping, from YAML metadata.
 */
export type IngredientIdentity = {
  // Normalized canonical key, e.g. "all-purpose-flour".
  canonicalName?: string;
  // Room to grow: schemaOrg mapping, allergens, category, substitutions 
};
