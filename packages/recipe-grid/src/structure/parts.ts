/**
 * Part vocabulary and attribute conventions for the framework-neutral render
 * structure.
 *
 * The single source of truth for how a rendered recipe grid is named. Every
 * element the core emits carries a stable `data-recipe-grid-<part>` marker (a
 * class-free styling/query hook). Scalable values and the recipe's scaling
 * metadata are surfaced as machine-readable `data-*` attributes so any consumer
 * — a runtime binding that rescales reactively, or a static renderer that emits
 * each scale ahead of time — can compute scaled output from the same markup.
 *
 * This module names things only; it emits no DOM and computes no values.
 */

const COMPONENT = 'recipe-grid';

/**
 * The parts of a rendered recipe grid. Each maps to a `data-recipe-grid-<part>`
 * marker attribute.
 *
 * - `root`              — the recipe container (one per recipe).
 * - `grid`              — the region that lays out the recipe trees.
 * - `title`             — the recipe title.
 * - `step`              — a Step node: a combining action over its inputs.
 * - `inputs`            — a step's input column (its children), laid out left of
 *                         the step's action; the left side of the bracket.
 * - `ingredient`        — an Ingredient leaf.
 * - `sub-recipe`        — a SubRecipe grouping.
 * - `sub-recipe-header` — the heading label of a `:=` sub-recipe.
 * - `reference`         — an intra-document reference to a sub-recipe output.
 * - `quantity`          — an amount rendered inline with an ingredient or reference.
 * - `scaled-value`      — a value that rescales with the recipe.
 */
export const RECIPE_GRID_PARTS = [
  'root',
  'grid',
  'title',
  'step',
  'inputs',
  'ingredient',
  'sub-recipe',
  'sub-recipe-header',
  'reference',
  'quantity',
  'scaled-value',
] as const;

export type RecipeGridPart = (typeof RECIPE_GRID_PARTS)[number];

/**
 * The marker attribute name for a part, e.g.
 * `part('step') === 'data-recipe-grid-step'`. Emitted with an empty-string
 * value as a class-free structural hook.
 */
export function part(name: RecipeGridPart): `data-${typeof COMPONENT}-${RecipeGridPart}` {
  return `data-${COMPONENT}-${name}`;
}

/** Every part's marker attribute name, keyed by part. */
export const PART_ATTRS = Object.fromEntries(
  RECIPE_GRID_PARTS.map((p) => [p, part(p)]),
) as { readonly [P in RecipeGridPart]: `data-${typeof COMPONENT}-${P}` };

/**
 * Data attributes that make scaling machine-readable. A scalable value carries
 * its unscaled base amount; the recipe root carries its scaling metadata. Both
 * are emitted as-is from the model — a `RecipeNumber` base value is either a
 * decimal or an exact `{ numerator, denominator }` fraction and is passed
 * through without flattening, so exact amounts survive rescaling.
 *
 * - `value`       — on a `scaled-value` element: its base `RecipeNumber`,
 *                   serialised (e.g. JSON), for a consumer to multiply by a
 *                   scale factor.
 * - `scalingType` — on the root: 'servings' | 'fixed'.
 * - `base`        — on the root: the as-authored base to scale from.
 *
 * Additional recipe metadata is surfaced on the root under the same
 * `data-recipe-grid-*` convention so a future model superset extends without a
 * new mechanism.
 */
export const DATA_KEYS = {
  value: `data-${COMPONENT}-value`,
  scalingType: `data-${COMPONENT}-scaling-type`,
  base: `data-${COMPONENT}-base`,
} as const;

export type DataKey = keyof typeof DATA_KEYS;
