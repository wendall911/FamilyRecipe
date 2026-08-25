/**
 * Known unit names, derived from parse-ingredient's unit-of-measure definitions.
 *
 * Only the unit *names* are used here so the grammar to recognise a unit.
 * At the time of authoring parse-ingredient had the most complete grammar for
 * units. This design allows for it to be safely changed or extended if the
 * package ever gets stale or is abandoned. No parsing capabilities are used,
 * only units and their corresponding types.
 *
 */

import { unitsOfMeasure } from 'parse-ingredient';

/**
 * Every name a unit may be written as: the canonical key, its short form, its
 * plural, and every known alternate. Deduped so the same string can appear in
 * more than one of those roles.
 * 
 * Currently no expaneded alternatives, but stubbing so expansion can happen if
 * needed in the future.
 */
const UNIT_NAMES: readonly string[] = [
    ...new Set(
        Object.entries(unitsOfMeasure).flatMap(([name, uom]) => [
            name,
            uom.short,
            uom.plural,
            ...uom.alternates,
        ])
    ),
];

/**
 * A single unit name as a Peggy expression: a case-insensitive literal or 
 * a multi-word name, a sequence of literals separated by `hsp` (the
 * grammar's horizontal-whitespace rule) so interior whitespace matches like
 * canonical's `\s+`.
 */
function toPeggyExpr(name: string): string {
    return name
        .split(' ')
        .map((word) => `"${word}"i`)
        .join(' hsp ');
}

/**
 * A Peggy ordered-choice fragment matching any known unit name. Peggy has no
 * inline regex, so units are expressed as `/`-separated case-insensitive
 * literals. Ordered choice is first-match, so names are emitted longest-first
 * to match maximally (e.g. "kilogram" before "kilo" before "kg"). This is the
 * value substituted for `@KNOWN_UNITS@` in the grammar.
 */
export const KNOWN_UNITS_PEGGY: string = [...UNIT_NAMES]
    .sort((a, b) => b.length - a.length)
    .map(toPeggyExpr)
    .join(' / ');
