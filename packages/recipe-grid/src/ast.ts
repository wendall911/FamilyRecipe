/**
 * Abstract Syntax Tree (AST) for the recipe syntax.
 *
 * This is the syntactic tree the grammar produces; the compiler stage 
 * turns it into the recipe model.
 */

import type {
    Fraction
} from './model.ts';

/**
 * A recipe numeric value: an integer/decimal, or an exact fraction.
 */
export type RecipeNumber = number | Fraction;

/**
 * A substring used literally within a String.
 */
export interface Substring {
    kind: 'substring';
    // Source offset (in chars) of this substring.
    offset: number;
    string: string;
}

/**
 * A number forming part of a String, which scales with the recipe.
 */
export interface InterpolatedValue {
    kind: 'interpolatedValue';
    // Source offset (in chars) of this value.
    offset: number;
    number: RecipeNumber;
}

/**
 * A string which may contain numerical values interpolated as the recipe is
 * re-scaled. Made up of substrings which concatenate to the full string.
 */
export interface String {
    kind: 'string';
    // Source offset (in chars): the offset of the first substring.
    offset: number;
    substrings: (Substring | InterpolatedValue)[];
}

/**
 * An absolute quantity, e.g. "300g of".
 */
export interface Quantity {
    kind: 'quantity';
    // Source offset (in chars).
    offset: number;
    value: RecipeNumber;
    // The unit name, or null for a unitless quantity.
    unit: String | null;
    // The whitespace, if any, between value and unit.
    valueUnitSpacing: string;
    /**
     * An unquoted preposition following the quantity (e.g. " of" in "50g of
     * butter"), or empty string.
     */
    preposition: string;
}

/**
 * "Use whatever is left" of a referenced output, e.g. "remaining" or "rest of".
 * A bare marker, no numeric value. (Diverges from [G2] numeric Proportion,
 * which the real recipe corpus never uses; splits are only ever "the rest".)
 */
export interface Remainder {
    kind: 'remainder';
    // Source offset (in chars).
    offset: number;
    // The wording used (e.g. "remaining", "rest").
    wording: string;
    // The words and whitespace following the remainder wording.
    preposition: string;
}

/** A step, e.g. 'mix(tomatoes, herbs)'. */
export interface Step {
    kind: 'step';
    // Source offset (in chars): the offset of the step name.
    offset: number;
    // The description of the step ('mix' in this example).
    name: String;
    // The inputs to this step ('tomatoes' and 'herbs').
    inputs: Expr[];
    // The `ingredient = X` label naming this node, when authored; else null.
    label?: String;
}

/**
 * A reference to an ingredient or a sub-recipe.
 */
export interface Reference {
    kind: 'reference';
    // Source offset (in chars).
    offset: number;
    // The name of the ingredient or sub-recipe.
    name: String;
    // The amount of the referenced item: an absolute quantity or the rest, or null.
    amount: Quantity | Remainder | null;
    // The `ingredient = X` label naming this node, when authored; else null.
    label?: String;
}

/**
 * A cross-file reference, a bare markdown link, e.g. `[Dough](pizza-dough)`
 * or `[Dough](pizza-dough "Dad's pizza dough")`. Points at another recipe by
 * slug. Its bodies are captured raw (plain strings, not {@link String} nodes),
 * matching the markdown-link surface: self-naming, so the link text is both the
 * display name and the reference handle. A pointer only — the target may not
 * exist; that (and slug validity) is a separate validation concern, not the
 * parser's.
 */
export interface ExternalReference {
    kind: 'externalReference';
    // Source offset (in chars).
    offset: number;
    // The link text: display name and reference handle.
    name: string;
    // The link destination: the target recipe's slug.
    targetSlug: string;
    // The markdown link title (quotes stripped), when authored; else absent.
    title?: string;
}

/**
 * An expression: a step, a reference, or a cross-file external reference.
 */
export type Expr = Step | Reference | ExternalReference;

/**
 * A statement in a recipe.
 */
export interface Stmt {
    kind: 'stmt';
    // Source offset (in chars).
    offset: number;
    // The expression contained in this statement.
    expr: Expr;
    // Explicitly named outputs produced by this statement, or null.
    outputs: String[] | null;
    // True if `:=` was used (the sub-recipe is explicitly named).
    named: boolean;
}

/**
 * Root of a recipe AST: the list of statements.
 */
export interface Recipe {
    kind: 'recipe';
    // Source offset (in chars): the offset of the first statement.
    offset: number;
    stmts: Stmt[];
}
