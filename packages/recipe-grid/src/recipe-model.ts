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
 *   1. Scaling (`scale(node, factor)`) — Grid 2's `.scale()` method family
 *      rescales embedded numbers and quantity values. Not ported here: scaling
 *      is a runtime concern the renderer drives, not something compilation runs.
 *      When added, it belongs alongside these functions and shares the library.
 *   2. Unit formatting — turning a unit string + value into display text.
 *      A renderer/library concern, not modelled here.
 */

import type {
  RecipeNumber,
  ScaledValueString,
  ScaledValueStringPart,
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

