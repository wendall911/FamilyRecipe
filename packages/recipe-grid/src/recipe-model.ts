/**
 * Recipe model behaviour — the free-function layer bridging the decorative
 * types in `model.ts` to real operations.
 *
 * `model.ts` declares plain-object shapes; TypeScript there enforces nothing at
 * runtime. This file supplies the behaviour Recipe Grid 2 attaches to those
 * shapes as methods (mossblaser's `recipe_grid`, `recipe.py`), ported as free
 * functions over the plain objects so `model.ts` stays a pure type module.
 *
 * Provenance:
 *   [G2] — faithful to Recipe Grid 2 (recipe.py / compiler.py).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DEFERRED: units
 * ─────────────────────────────────────────────────────────────────────────────
 * A real quantity/unit library (conversion, scaling arithmetic, formatting) is
 * a separate, deferred concern. Every place that library will plug in is marked
 * inline with `[DEFERRED: units]`. Grep that tag to find every seam. The seams:
 *
 *   1. `quantitiesHaveEqualValue` — Grid 2 converts between units
 *      (`UNIT_SYSTEM.convert_between`) before comparing. Until the units library
 *      lands this compares only same-unit / both-unitless quantities; quantities
 *      in differing units are treated as unequal (so cross-unit sub-recipes are
 *      not inlined that otherwise could be, e.g. 1000g vs 1kg).
 *   2. Scaling (`scale(node, factor)`) — Grid 2's `.scale()` method family
 *      rescales embedded numbers and quantity values. Not ported here: scaling
 *      is a runtime concern the renderer drives, not something compilation runs.
 *      When added, it belongs alongside these functions and shares the library.
 *   3. Unit formatting — turning a unit string + value into display text.
 *      A renderer/library concern, not modelled here.
 */

import type {
  Amount,
  Ingredient,
  Quantity,
  RecipeNumber,
  RecipeTreeNode,
  Remainder,
  ScaledValueString,
  ScaledValueStringPart,
  Step,
  SubRecipe,
} from './model.ts';

import type { InterpolatedValue, String as AstString, Substring } from './ast.ts';

// ─────────────────────────────────────────────────────────────────────────────
// RecipeNumber
// ─────────────────────────────────────────────────────────────────────────────

/** [G2] True if a RecipeNumber is an exact fraction (vs a plain number). */
function isFraction(n: RecipeNumber): n is { numerator: number; denominator: number } {
  return typeof n === 'object' && n !== null && 'numerator' in n && 'denominator' in n;
}

/** [G2] The numeric (float) value of a RecipeNumber. */
export function numberValue(n: RecipeNumber): number {
  return isFraction(n) ? n.numerator / n.denominator : n;
}

/** [G2] Structural equality of two RecipeNumbers (exact for fractions). */
export function recipeNumbersEqual(a: RecipeNumber, b: RecipeNumber): boolean {
  if (isFraction(a) && isFraction(b)) {
    return a.numerator === b.numerator && a.denominator === b.denominator;
  }
  if (isFraction(a) || isFraction(b)) {
    return numberValue(a) === numberValue(b);
  }
  return a === b;
}

// ─────────────────────────────────────────────────────────────────────────────
// ScaledValueString
// ─────────────────────────────────────────────────────────────────────────────

/** True if a ScaledValueString part is a literal string (vs an embedded number). */
function isStringPart(part: ScaledValueStringPart): part is string {
  return typeof part === 'string';
}

/**
 * [G2] recipe.py's ScaledValueString normalises to adjacent-strings-merged,
 * empty-strings-dropped form. Applied after any construction/mutation so equal
 * strings compare equal regardless of how their parts were split.
 */
export function svsNormalize(svs: ScaledValueString): ScaledValueString {
  const out: ScaledValueStringPart[] = [];
  for (const part of svs) {
    if (isStringPart(part)) {
      if (part === '') continue;
      const last = out[out.length - 1];
      if (last !== undefined && isStringPart(last)) {
        out[out.length - 1] = last + part;
        continue;
      }
    }
    out.push(part);
  }
  return out;
}

/** [G2] The literal (unscaled) text of a ScaledValueString, numbers rendered as-is. */
export function svsToString(svs: ScaledValueString): string {
  return svs
    .map((part) => (isStringPart(part) ? part : String(numberValue(part))))
    .join('');
}

/**
 * [G2] compiler.py `normalise_output_name`: strip surrounding whitespace and
 * lower-case, for case/whitespace-insensitive output-name matching. Operates on
 * the string form (output names are matched as text in the name table).
 */
export function normaliseOutputName(svs: ScaledValueString): string {
  return svsToString(svs).trim().toLowerCase();
}

/** [G2] Structural equality of two ScaledValueStrings (after normalisation). */
export function svsEqual(a: ScaledValueString, b: ScaledValueString): boolean {
  const na = svsNormalize(a);
  const nb = svsNormalize(b);
  if (na.length !== nb.length) return false;
  return na.every((part, i) => {
    const other = nb[i];
    if (isStringPart(part) || isStringPart(other)) return part === other;
    return recipeNumbersEqual(part, other);
  });
}

/**
 * [G2] compiler.py `compile_string`: turn an AST String (substrings +
 * interpolated values) into a model ScaledValueString.
 */
export function compileString(astString: AstString): ScaledValueString {
  const parts: ScaledValueStringPart[] = astString.substrings.map((part) =>
    part.kind === 'substring'
      ? (part as Substring).string
      : (part as InterpolatedValue).number,
  );
  return svsNormalize(parts);
}

// ─────────────────────────────────────────────────────────────────────────────
// Quantity value comparison
// ─────────────────────────────────────────────────────────────────────────────

/**
 * [G2] recipe.py `Quantity.has_equal_value_to`: true if two quantities carry
 * the same value, ignoring metadata (spacing/preposition).
 *
 * [DEFERRED: units] Grid 2 converts `other` into `self`'s unit via
 * `UNIT_SYSTEM.convert_between` before comparing, so 1000g equals 1kg. Without
 * the units library we only compare:
 *   - both unit-less                -> compare values
 *   - same unit (case-insensitive)  -> compare values
 *   - one unit-less, one not        -> not equal
 *   - differing units               -> not equal (no conversion available yet)
 * When the units library lands, the differing-units branch converts and
 * compares instead of returning false.
 */
export function quantitiesHaveEqualValue(a: Quantity, b: Quantity): boolean {
  if (a.unit === null && b.unit === null) {
    return recipeNumbersEqual(a.value, b.value);
  }
  if (a.unit === null || b.unit === null) {
    return false;
  }
  if (a.unit.toLowerCase() !== b.unit.toLowerCase()) {
    return false; // [DEFERRED: units] no cross-unit conversion yet
  }
  return recipeNumbersEqual(a.value, b.value);
}

/**
 * A reference amount is "the full amount" (compiler.py `can_be_inlined`): a
 * Remainder ("use the rest") is trivially the full amount; a Quantity must
 * match the referenced output's quantity.
 */
export function amountIsFullQuantityOf(amount: Amount, quantity: Quantity): boolean {
  if (amount.kind === 'remainder') return true;
  return quantitiesHaveEqualValue(amount, quantity);
}

// ─────────────────────────────────────────────────────────────────────────────
// Node structural equality
// ─────────────────────────────────────────────────────────────────────────────

/**
 * [G2] recipe.py nodes are frozen dataclasses; `self == old` is *structural*
 * (value) equality, not identity. `substitute` and the compiler's name table
 * both rely on this. Deep-compares by kind.
 */
export function nodesEqual(a: RecipeTreeNode, b: RecipeTreeNode): boolean {
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case 'ingredient': {
      const y = b as Ingredient;
      return (
        svsEqual(a.description, y.description) &&
        quantitiesEqual(a.quantity, y.quantity)
      );
    }
    case 'step': {
      const y = b as Step;
      return (
        svsEqual(a.description, y.description) &&
        a.inputs.length === y.inputs.length &&
        a.inputs.every((child, i) => nodesEqual(child, y.inputs[i]))
      );
    }
    case 'subRecipe': {
      const y = b as SubRecipe;
      return (
        a.outputNames.length === y.outputNames.length &&
        a.outputNames.every((n, i) => svsEqual(n, y.outputNames[i])) &&
        nodesEqual(a.subTree, y.subTree)
      );
    }
    case 'reference': {
      const y = b as import('./model.ts').Reference;
      // A reference is a back-pointer; the DAG is cyclic when nodes are shared.
      // Compare by target *identity* (not structural recursion, which would loop
      // on a cycle): two references are equal iff they point at the same node
      // with the same output index and amount.
      return (
        a.resolvedNode === y.resolvedNode &&
        a.outputIndex === y.outputIndex &&
        (a.amount === undefined) === (y.amount === undefined) &&
        (a.amount === undefined || amountsEqual(a.amount, y.amount as Amount))
      );
    }
    case 'recipeReference': {
      const y = b as import('./model.ts').RecipeReference;
      return (
        a.targetSlug === y.targetSlug &&
        (a.outputName === undefined) === (y.outputName === undefined) &&
        (a.outputName === undefined ||
          svsEqual(a.outputName, y.outputName as ScaledValueString)) &&
        (a.amount === undefined) === (y.amount === undefined) &&
        (a.amount === undefined || amountsEqual(a.amount, y.amount as Amount))
      );
    }
  }
}

function quantitiesEqual(a: Quantity | null, b: Quantity | null): boolean {
  if (a === null || b === null) return a === b;
  return (
    quantitiesHaveEqualValue(a, b) &&
    a.valueUnitSpacing === b.valueUnitSpacing &&
    a.preposition === b.preposition
  );
}

function amountsEqual(a: Amount, b: Amount): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'remainder') {
    const y = b as Remainder;
    return a.wording === y.wording && a.preposition === y.preposition;
  }
  return quantitiesEqual(a, b as Quantity);
}

// ─────────────────────────────────────────────────────────────────────────────
// Substitution
// ─────────────────────────────────────────────────────────────────────────────

/**
 * [G2] recipe.py `RecipeTreeNode.substitute`: return a copy of the tree with
 * `old` replaced by `new`, leaving the input intact. Structural equality (not
 * identity) decides the match. Nodes are immutable: copies are made, nothing is
 * mutated. Per-node recursion mirrors each node type's `substitute` method.
 */
export function substitute(
  node: RecipeTreeNode,
  oldNode: RecipeTreeNode,
  newNode: RecipeTreeNode,
): RecipeTreeNode {
  if (nodesEqual(node, oldNode)) return newNode;
  switch (node.kind) {
    case 'ingredient':
    case 'recipeReference':
    case 'reference':
      // Leaf w.r.t. substitution. A reference is a back-pointer to a node that
      // lives elsewhere in the tree; that node is substituted at its definition
      // site, and descending through the pointer here would loop on the cycle.
      return node;
    case 'step':
      return {
        ...node,
        inputs: node.inputs.map((child) => substitute(child, oldNode, newNode)),
      };
    case 'subRecipe':
      return {
        ...node,
        subTree: substitute(node.subTree, oldNode, newNode),
      };
  }
}

/**
 * [G2] compiler.py `infer_quantity`: the quantity of the sole ingredient in a
 * single-ingredient chain (descending through single-input steps and
 * single-output sub-recipes), or null.
 */
export function inferQuantity(node: RecipeTreeNode): Quantity | null {
  if (node.kind === 'ingredient') return node.quantity;
  if (node.kind === 'step' && node.inputs.length === 1) {
    return inferQuantity(node.inputs[0]);
  }
  if (node.kind === 'subRecipe' && node.outputNames.length === 1) {
    return inferQuantity(node.subTree);
  }
  return null;
}
