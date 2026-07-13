/**
 * Known unit names, ported from recipe_grid's units.py (UNIT_SYSTEM).
 *
 * Only the unit *names* are ported here — enough for the grammar to recognise a
 * unit. The unit-conversion system (scaling between units) is a separate,
 * later concern and is not included.
 *
 * Order is preserved from units.py so the generated alternation's match
 * precedence matches the canonical grammar.
 */

/** All known unit names and aliases, in canonical order. */
export const UNIT_NAMES: readonly string[] = [
    // mass
    'g', 'gram', 'grams',
    'kg', 'kilo', 'kilos', 'kilogram', 'kilograms',
    'lb', 'lbs', 'pound', 'pounds',
    'oz', 'ozs', 'ounce', 'ounces',
    // volume
    'l', 'litre',
    'ml', 'mill', 'mills', 'milliliter', 'milliliters',
    'tsp', 'tsps', 'teaspoons', 'teaspoon', 'tea spoon', 'tea spoons',
    'tbsp', 'tbsps', 'tablespoon', 'tablespoons', 'table spoon', 'table spoons',
    'cup', 'cups',
    'pint', 'pints',
    // other
    'clove', 'cloves',
    'bulb', 'bulbs',
    'can', 'cans', 'tin', 'tins',
    'pinch', 'pinches',
    'knob', 'knobs',
    'packet', 'packets', 'pack', 'packs',
    'box', 'boxes', 'boxen',
    'bag', 'bags',
    'sack', 'sacks',
    'sachet', 'sachets',
    'rasher', 'rashers',
    'strip', 'strips',
];

/**
 * A single unit name as a Peggy expression: a case-insensitive literal, or —
 * for a multi-word name — a sequence of literals separated by `hsp` (the
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
