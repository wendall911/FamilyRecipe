/**
 * Recipe model behaviour. The free-function layer bridging the decorative
 * types in `model.ts` to real operations.
 *
 * Provenance:
 *   [EXT] - compatible with [G2] but adopts a real units library, not a hand 
 *   authored list.
 *
 */

/**
 * -----------------------------------------------------------------------------
 * UNITS
 * -----------------------------------------------------------------------------
 * parse-ingredient is used for units vocabulary. Its `unitsOfMeasure` feeds
 * the grammar's units (`units.ts`) and the identity lookup below.
 *
 * This layer binds a quantity's authored unit name to its canonical key
 * (`unitOfMeasureID`), and carries both. Values stay as authored; the key is
 * the handle. A consumer with the same library and can convert, scale, or
 * format from the bindings for a locale display, a unit selector, scaling at
 * render, etc.
 */
import { unitsOfMeasure } from 'parse-ingredient';

import type {
    RecipeNumber,
    ScaledValueString,
    ScaledValueStringPart,
} from './model.ts';

import type {
    InterpolatedValue,
    String as AstString,
    Substring
  } from './ast.ts';

/**
 * [G2] True if a RecipeNumber is an exact fraction (vs a plain number).
 */
function isFraction(n: RecipeNumber): n is { numerator: number; denominator: number } {
    return typeof n === 'object' && n !== null && 'numerator' in n && 'denominator' in n;
}

/**
 * [G2] The numeric (float) value of a RecipeNumber.
 */
export function numberValue(n: RecipeNumber): number {
    return isFraction(n) ? n.numerator / n.denominator : n;
}

/**
 * [G2] Structural equality of two RecipeNumbers (exact for fractions).
 */
export function recipeNumbersEqual(a: RecipeNumber, b: RecipeNumber): boolean {
    if (isFraction(a) && isFraction(b)) {
        return a.numerator === b.numerator && a.denominator === b.denominator;
    }
    else if (isFraction(a) || isFraction(b)) {
        return numberValue(a) === numberValue(b);
    }

    return a === b;
}

/**
 * True if a ScaledValueString part is a literal string (vs an embedded number).
 */
function isStringPart(part: ScaledValueStringPart): part is string {
    return typeof part === 'string';
}

/**
 * [G2] ScaledValueString normalises to adjacent-strings-merged,
 * empty-strings-dropped form. Applied after any construction/mutation so equal
 * strings compare equal regardless of how their parts were split.
 */
export function svsNormalize(svs: ScaledValueString): ScaledValueString {
    const out: ScaledValueStringPart[] = [];

    for (const part of svs) {
        if (isStringPart(part)) {
            if (part === '') {
                continue;
            }

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

/**
 * [G2] The literal (unscaled) text of a ScaledValueString, numbers rendered as-is.
 */
export function svsToString(svs: ScaledValueString): string {
    return svs.map((part) => (
        isStringPart(part) ? part : String(numberValue(part))
    )).join('');
}

/**
 * [G2] strip surrounding whitespace and lower-case, for case/whitespace-insensitive 
 * output-name matching. Operates on the string form (output names are matched as 
 * text in the name table).
 */
export function normalizeOutputName(svs: ScaledValueString): string {
    return svsToString(svs).trim().toLowerCase();
}

/**
 * [G2] Structural equality of two ScaledValueStrings (after normalisation).
 */
export function svsEqual(a: ScaledValueString, b: ScaledValueString): boolean {
    const na = svsNormalize(a);
    const nb = svsNormalize(b);

    if (na.length !== nb.length) {
        return false;
    }

    return na.every((part, i) => {
        const other = nb[i];

        if (isStringPart(part) || isStringPart(other)) {
            return part === other;
        }

        return recipeNumbersEqual(part, other);
    });
}

/**
 * [G2] turn an AST String (substrings + interpolated values) into a model 
 * ScaledValueString.
 */
export function compileString(astString: AstString): ScaledValueString {
    const parts: ScaledValueStringPart[] = astString.substrings.map((part) =>
        part.kind === 'substring'
            ? (part as Substring).string
            : (part as InterpolatedValue).number,
    );

    return svsNormalize(parts);
}

/**
 * Every written form of a unit, lowercased, mapped to its canonical key: the
 * `unitsOfMeasure` record key, its `short` and `plural` forms, and every
 * `alternate`. Built once.
 *
 * First one wins. Lowercasing collides some forms across entries ("T" and "t",
 * "C" and "c"); the earlier entry keeps the key. Sorting that out is a
 * validation concern, not this lookup's.
 */
const unitIdByName: Map<string, string> = (() => {
    const map = new Map<string, string>();

    for (const [id, uom] of Object.entries(unitsOfMeasure)) {
        for (const name of [id, uom.short, uom.plural, ...uom.alternates]) {
            const key = name.toLowerCase();

            if (!map.has(key)) {
                map.set(key, id);
            }
        }
    }

    return map;
})();

/**
 * The canonical unit key a written unit name resolves to, or null when the name
 * is not a known unit. Case-insensitive, matching the grammar's unit
 * alternation.
 */
export function unitOfMeasureID(unitOfMeasure: string | null): string | null {
    if (unitOfMeasure === null) {
        return null;
    }

    return unitIdByName.get(unitOfMeasure.toLowerCase()) ?? null;
}

