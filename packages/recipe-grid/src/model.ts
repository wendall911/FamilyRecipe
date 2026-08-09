/**
 * Recipe Grid model - the object model / data structure for a parsed recipe.
 *
 * A divergent port of the Recipe Grid 2 semantic model: faithful where the two
 * agree, deliberately different where this project's goals differ (e.g.
 * Remainder replaces Grid 2's numeric Proportion; Reference is generalised to
 * target any node). Consumes most Grid 2 recipes; not a strict superset.
 * (Full attribution / licensing lives in the README + credits, not here.)
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
 * [G2] A recipe numeric value. Grid 2 uses `int | float | Fraction`, where
 * `Fraction` is *exact* (1/4 tsp stays 1/4, never 0.25). JS `number` cannot
 * represent exact fractions, so exact values are held as a {@link Fraction}.
 * The concrete arithmetic/formatting is handled by a dedicated value handler
 * (a fraction library), not by this type.
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
 *   ["divide into ", 8, " burgers about 10cm in diameter"]
 *
 * On scale(×2) the `8` becomes `16`; the "10cm" text is untouched. Normalized
 * form: adjacent strings merged, empty strings dropped. Used for every
 * description / step name / output name in the model.
 */
export type ScaledValueStringPart = string | RecipeNumber;
export type ScaledValueString = ScaledValueStringPart[];

/**
 * [EXT] An absolute quantity, e.g. "50g of", "3 apples". Diverges from Grid 2,
 * which carried only the authored unit text: a quantity here also carries the
 * canonical unit identity, so a consumer can convert without re-matching a
 * string the grammar already matched.
 */
export type Quantity = {
    kind: "quantity";
    // [G2] The amount.
    value: RecipeNumber;
    // [G2] Unit name as authored, or null for a unit-less count (e.g. 3 apples).
    unitOfMeasure: string | null;
    /**
     * [EXT] The canonical unit key `unitOfMeasure` resolves to -- the
     * parse-ingredient `unitsOfMeasure` record key ("cloves" -> "clove",
     * "g" -> "gram"). Carried alongside `unitOfMeasure`, never instead of it:
     * one is what the author wrote and what renders, the other is the handle a
     * consumer looks up. Null exactly when `unitOfMeasure` is null.
     */
    unitOfMeasureID: string | null;
    // [G2] Whitespace between value and unit; "" when there is no unit.
    valueUnitSpacing: string;
    // [G2] Trailing preposition incl. leading space, e.g. " of" in "50g of".
    preposition: string;
};

/**
 * [EXT] "Use whatever is left" of a referenced output -- a bare marker, not a
 * computed proportion. Diverges from Grid 2's numeric Proportion (percent /
 * multiplier / fractional value): the published Grid 2 recipe corpus never uses
 * numeric proportions, and real recipes only ever say "use the rest later". It
 * carries no value - the ingredient list is the definitive amount; ingredient
 * consumption is a validation concern, not the parser's. Appears once,
 * at an ingredient's final use, drawn as a back-reference in the overview.
 */
export type Remainder = {
    kind: "remainder";
    // [EXT] The wording used (e.g. "remaining", "rest"), for display.
    wording: string;
    /**
     * [EXT] Trailing preposition incl. leading space, e.g. " of the" in "rest of
     * the sauce". Retained (not discarded) so a later validator can check
     * the authored wording against the ingredient list.
     */
    preposition: string;
};

/**
 * [G2] The amount of a referenced output to use: an absolute amount or the rest.
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
     * [G2] The author's recipe-local mapping label from an `ingredient = X`
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
     * [G2] The author's recipe-local mapping label from an `ingredient = X`
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
    // [G2] How much of the output to use; absent means all of it.
    amount?: Amount;
};

/**
 * [EXT] How a recipe scales. Grid 2 has no scaling metadata (it inferred a
 * serving count from the title); this is a divergence. Declared in
 * the recipe's YAML frontmatter and read by the markdown layer. This type is
 * the single source of truth for that shape -- the markdown layer references it.
 * A recipe with no frontmatter is 'fixed', base 1, matching Grid 2 recipes.
 */
export type RecipeScaling = {
    // [EXT] How this recipe scales. Absent frontmatter defaults to 'fixed'.
    scalingType: "servings" | "fixed";
    /**
     * [EXT] The as-authored base to scale from. For 'servings' it is the base
     * serving count (e.g. 2). Absent frontmatter defaults to 1.
     */
    base?: RecipeNumber;
    /**
     * [EXT] The measurement system the authored quantities are read in -- a
     * `parse-ingredient` UnitSystem value. Absent frontmatter defaults to 'us'.
     */
    unitSystem: "us" | "imperial" | "metric";
};

/**
 * [EXT] Recipe-level metadata, resolved by the markdown/extraction layer and
 * handed to the compiler as one bundle; the compiler stamps the relevant fields
 * onto the {@link Recipe}. Grows over time (scaling now; room for further
 * recipe-level data such as nutrition). This is the single source of truth for
 * its shape; the markdown layer references it.
 */
export type RecipeMeta = RecipeScaling & {
    /**
     * [EXT] The recipe id: the authored frontmatter value if present, else a slug
     * derived from the title. Always resolved to a concrete string by the
     * extraction layer, so it is required here.
     */
    slug: string;
};

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
 * title, rendering a link, showing "not found") is a concern of the site/index
 * layer, not this model. A dangling reference is still valid.
 */
export type RecipeReference = {
    kind: "recipeReference";
    /**
     * [EXT] The link text: both the displayed name and the handle later lines
     * resolve to. A bare markdown link is self-defining, so there is no separate
     * `label` (which exists elsewhere only to give a node an internal id distinct
     * from its display text, which a split this node does not have).
     */
    name: string;
    // [EXT] Identity (slug) of the target recipe file — the link destination.
    targetSlug: string;
    /**
     * [EXT] The markdown link title (the third `[text](slug "title")` token), when
     * authored. Carried through the DAG so the render side constructs the
     * `<a title="...">`. Optional: a bare link has none.
     */
    title?: string;
};

/**
 * [EXT] Structured/canonical ingredient identity.
 *
 * Grid 2's {@link Ingredient} carries only a scale-aware description string.
 * This optional structure adds a canonical identity for typed ingredients and
 * later schema.org / allergen / category mapping, from YAML metadata.
 */
export type IngredientIdentity = {
  // [EXT] Normalized canonical key, e.g. "all-purpose-flour".
  canonicalName?: string;
  // Room to grow: schemaOrg mapping, allergens, category, substitutions 
};
