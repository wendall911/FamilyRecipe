/**
 * Part vocabulary and attribute conventions for the framework-neutral render
 * structure.
 *
 * The single source of truth for how a rendered recipe grid is named. Four
 * layers of attribute:
 *
 *   {@link PART_ATTRS}     what a node is. One per element, empty value.
 *   {@link DATA_KEYS}      a value a consumer reads.
 *   {@link STRUCTURE_KEYS} markers for layout.
 *   {@link STYLE_KEYS}     markers for styling.
 */

const COMPONENT = 'recipe-grid';

/**
 * The parts of a rendered recipe grid. Each maps to a `data-recipe-grid-<part>`
 * marker attribute.
 *
 * - `root`              the recipe container for metadata bindings.
 * - `card`              the region that lays out the recipe.
 * - `title`             the recipe title.
 * - `step`              a Step node: a combining action over its inputs. The
 *                       bracket itself, holding the inputs column and the
 *                       action beside it.
 * - `inputs`            a step's input column (its children), laid out left of
 *                       the step's action; the left side of the bracket.
 * - `action`            a step's own action, to the right of what feeds it; the
 *                       right side of the bracket. Render structure, not a
 *                       model node: the step it belongs to is the `step` part
 *                       above it.
 * - `ingredient`        an Ingredient leaf.
 * - `sub-recipe`        a SubRecipe grouping: the header band and the body
 *                       beneath it, together.
 * - `sub-recipe-header` the heading label of a `:=` sub-recipe.
 * - `sub-recipe-body`   everything under that band. Render structure, not a
 *                       model node.
 * - `reference`         an intra-document reference to a sub-recipe output.
 * - `remainder`         a "use the rest" note at a reference (the remainder
 *                       wording, e.g. "Remaining"); carries no value.
 * - `recipe-reference`  a cross-file reference. The `a` inside carries the slug.
 * - `quantity`          an amount rendered inline with an ingredient or reference.
 * - `ingredient-description`
 *                       an ingredient's own authored text, e.g. "flour" or
 *                       "handful fresh coriander or parsley".
 * - `scaled-value`      a value that rescales with the recipe.
 * - `uom-name`          the authored unit name within a quantity, e.g.
 *                       "cloves"; the text a consumer converting the amount
 *                       rewrites.
 */
export const RECIPE_GRID_PARTS = [
    'root',
    'card',
    'title',
    'step',
    'inputs',
    'action',
    'ingredient',
    'sub-recipe',
    'sub-recipe-header',
    'sub-recipe-body',
    'reference',
    'remainder',
    'recipe-reference',
    'quantity',
    'ingredient-description',
    'scaled-value',
    'uom-name',
] as const;

export type RecipeGridPart = (typeof RECIPE_GRID_PARTS)[number];

/**
 * The marker attribute name for a part.
 */
export function part(name: RecipeGridPart): `data-${typeof COMPONENT}-${RecipeGridPart}` {
    return `data-${COMPONENT}-${name}`;
}

/**
 * Every part's marker attribute name, keyed by part.
 */
export const PART_ATTRS = Object.fromEntries(
    RECIPE_GRID_PARTS.map((p) => [p, part(p)]),
) as { readonly [P in RecipeGridPart]: `data-${typeof COMPONENT}-${P}` };


/**
 * The semantic HTML tag each part renders as.
 */
export const TAG_FOR_PART: { readonly [P in RecipeGridPart]: string } = {
    [part('root')]: 'div',
    [part('card')]: 'div',
    [part('title')]: 'h1',
    [part('step')]: 'div',
    [part('inputs')]: 'div',
    [part('action')]: 'div',
    [part('ingredient')]: 'div',
    [part('sub-recipe')]: 'div',
    [part('sub-recipe-header')]: 'h2',
    [part('sub-recipe-body')]: 'div',
    [part('reference')]: 'div',
    [part('remainder')]: 'div',
    [part('recipe-reference')]: 'div',
    [part('quantity')]: 'span',
    [part('ingredient-description')]: 'span',
    [part('scaled-value')]: 'span',
    [part('uom-name')]: 'span',
} as { readonly [P in RecipeGridPart]: string };

/**
 * The semantic HTML tag for a part marker; a neutral `div` when unmapped.
 */
export function tagForPart(partAttr: string): string {
    return TAG_FOR_PART[partAttr as keyof typeof TAG_FOR_PART] ?? 'div';
}

/**
 * Data attributes.
 *
 * - `value`       on a `scaled-value` element: its base `RecipeNumber`,
 *                 serialised (e.g. JSON), for a consumer to multiply by a
 *                 scale factor.
 * - `uomID`       on an `ingredient`. The key into parse-ingredient's
 *                 `unitsOfMeasure` (`Record<string, UnitOfMeasure>`). The
 *                 authored text is the `uom-name` span inside.
 * - `scalingType` on the root: 'servings' | 'fixed'.
 * - `base`        on the root: the as-authored base to scale from.
 * - `unitSystem`  on the root: the measurement system the authored quantities
 *                 are read in, 'us' | 'imperial' | 'metric'.
 * - `targetSlug`  on the `a` inside a `recipe-reference`. The target recipe's slug.
 *
 */
export const DATA_KEYS = {
    value: `data-${COMPONENT}-value`,
    uomID: `data-${COMPONENT}-uom-id`,
    scalingType: `data-${COMPONENT}-scaling-type`,
    base: `data-${COMPONENT}-base`,
    unitSystem: `data-${COMPONENT}-unit-system`,
    targetSlug: `data-${COMPONENT}-target-slug`,
} as const;

export type DataKey = keyof typeof DATA_KEYS;

/**
 * The structure attributes. Resolved by the shape pass, written onto the
 * element so a rule matches on position instead of rebuilding it.
 *
 * - `side`   what the box is to its parent: `inputs`, `action`, `header`,
 *            `body`, `root`. The inputs column and a region's body have no
 *            part marker, so a rule reaches them by this.
 *
 * - `flow`   how the box lays its children out: `row`, `column`, `leaf` when
 *            its children are text. Pairs with a child's `edge`: flow gives the
 *            axis, edge gives the end.
 */
export const STRUCTURE_KEYS = {
    side: `${COMPONENT}-side`,
    flow: `${COMPONENT}-flow`,
} as const;

export type StructureKey = keyof typeof STRUCTURE_KEYS;

/**
 * The styling marker. The surfaces a theme decorates.
 *
 * - `edge`  which of a box's edges are its container's rather than a division
 *           with a neighbour: `start`, `end`, `both`, absent when it has a
 *           neighbour on each side. Along the parent's flow: row is
 *           left/right, column is top/bottom. A border on a container's edge
 *           bounds the group instead of dividing two members.
 */
export const STYLE_KEYS = {
    edge: `${COMPONENT}-edge`,
} as const;

export type StyleKey = keyof typeof STYLE_KEYS;
