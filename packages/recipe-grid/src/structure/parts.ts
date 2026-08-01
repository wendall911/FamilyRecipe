/**
 * Part vocabulary and attribute conventions for the framework-neutral render
 * structure.
 *
 * The single source of truth for how a rendered recipe grid is named. Every
 * element the core emits carries a stable `data-recipe-grid-<part>` marker (a
 * class-free styling/query hook). Scalable values and the recipe's scaling
 * metadata are surfaced as machine-readable `data-*` attributes so any consumer
 * (a runtime binding that rescales reactively, or a static renderer that emits
 * each scale ahead of time) can compute scaled output from the same markup.
 *
 * This module names things only: the part markers, the machine-readable data
 * attributes, and the semantic HTML tag each part renders as. It emits no DOM
 * and computes no values.
 */

const COMPONENT = 'recipe-grid';

/**
 * The parts of a rendered recipe grid. Each maps to a `data-recipe-grid-<part>`
 * marker attribute.
 *
 * - `root`              the recipe container (one per recipe).
 * - `grid`              the region that lays out the recipe trees.
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
 *                       model node: the region's tree lives here.
 * - `reference`         an intra-document reference to a sub-recipe output.
 * - `remainder`         a "use the rest" note at a reference (the remainder
 *                       wording, e.g. "Remaining"); carries no value.
 * - `recipe-reference`  a cross-file link to another recipe by slug.
 * - `quantity`          an amount rendered inline with an ingredient or reference.
 * - `scaled-value`      a value that rescales with the recipe.
 */
export const RECIPE_GRID_PARTS = [
    'root',
    'grid',
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

/**
 * Every part's marker attribute name, keyed by part.
 */
export const PART_ATTRS = Object.fromEntries(
    RECIPE_GRID_PARTS.map((p) => [p, part(p)]),
) as { readonly [P in RecipeGridPart]: `data-${typeof COMPONENT}-${P}` };

/**
 * The suggested component name a framework binding uses for a part: the kebab
 * part title-cased to PascalCase (`recipe-reference` -> `RecipeReference`,
 * `sub-recipe-header` -> `SubRecipeHeader`, `scaled-value` -> `ScaledValue`).
 *
 * This is a naming convention, not a strict part-to-model mapping. Parts are not
 * 1:1 with the model concepts (`title`, `inputs`, `sub-recipe-header` are render
 * structure, not model nodes), so every part gets a suggested name here even
 * when it has no model concept. It is derived, not a hand table: the rule (kebab
 * -> Pascal) is the stable thing, so a new part is covered without an edit, and
 * the derived name for a part that IS a model concept coincides with that
 * concept's name (`sub-recipe` -> `SubRecipe`) without this module referencing
 * the model. A binding (`-svelte`, `-react`, `-vue`) reads this to name its
 * components the same way across frameworks, without digging into internals.
 */
export function componentNameForPart(name: RecipeGridPart): string {
    return name
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join('');
}

/**
 * Every part's suggested binding component name, keyed by part.
 */
export const PART_COMPONENT_NAMES = Object.fromEntries(
    RECIPE_GRID_PARTS.map((p) => [p, componentNameForPart(p)]),
) as { readonly [P in RecipeGridPart]: string };

/**
 * The semantic HTML tag each part renders as. The element a part IS is a
 * semantic fact, not a layout choice: a title is a heading (`h1`), a sub-recipe
 * header a subheading (`h2`), a cross-file link an `a`. Everything structural is
 * a neutral `div`; inline text pieces are `span`s. Layout (flex, grid) is CSS,
 * so it changes without touching these tags. Keyed by the marker attribute name
 * so a lookup is `tagForPart(node.part)`; this is the mapping a framework
 * binding consumes to render the structure without re-deciding element choice.
 */
export const TAG_FOR_PART: { readonly [P in RecipeGridPart]: string } = {
    [part('root')]: 'div',
    [part('grid')]: 'div',
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
    [part('recipe-reference')]: 'a',
    [part('quantity')]: 'span',
    [part('scaled-value')]: 'span',
} as { readonly [P in RecipeGridPart]: string };

/**
 * The semantic HTML tag for a part marker; a neutral `div` when unmapped.
 */
export function tagForPart(partAttr: string): string {
    return TAG_FOR_PART[partAttr as keyof typeof TAG_FOR_PART] ?? 'div';
}

/**
 * Data attributes that make scaling machine-readable. A scalable value carries
 * its unscaled base amount; the recipe root carries its scaling metadata. Both
 * are emitted as-is from the model: a `RecipeNumber` base value is either a
 * decimal or an exact `{ numerator, denominator }` fraction and is passed
 * through without flattening, so exact amounts survive rescaling.
 *
 * - `value`       on a `scaled-value` element: its base `RecipeNumber`,
 *                 serialised (e.g. JSON), for a consumer to multiply by a
 *                 scale factor.
 * - `scalingType` on the root: 'servings' | 'fixed'.
 * - `base`        on the root: the as-authored base to scale from.
 *
 * The cross-file link binding attribute, on a `recipe-reference` element. The
 * core stays framework-neutral: it does not know how the consumer resolves the
 * target (an external site link, an in-page anchor, a route), so it emits the
 * raw slug as a data binding for the consumer to wire trivially, rather than
 * baking a resolved href into the markup. (The link's `title` is a real HTML
 * attribute, not a data binding, so it does not live here.)
 *
 * - `targetSlug`  on a `recipe-reference` element: the target recipe's slug.
 *
 * Additional recipe metadata is surfaced on the root under the same
 * `data-recipe-grid-*` convention so a future model superset extends without a
 * new mechanism.
 */
export const DATA_KEYS = {
    value: `data-${COMPONENT}-value`,
    scalingType: `data-${COMPONENT}-scaling-type`,
    base: `data-${COMPONENT}-base`,
    targetSlug: `data-${COMPONENT}-target-slug`,
} as const;

export type DataKey = keyof typeof DATA_KEYS;

/**
 * The flexbox facts a box carries into the DOM.
 *
 * A part marker says what a node is; {@link DATA_KEYS} carries the model data a
 * consumer computes with. These say where a box sits in the card -- the facts
 * the shape pass resolved, written onto the element so a consumer is not left
 * deriving them from the markup.
 *
 * - `side`   what the box is to its parent: `inputs`, `action`, `header`,
 *            `body`, or `root`. The inputs column and a region's body have no
 *            part of their own, so this is what a rule targets them by.
 *
 * The shape pass also resolves adjacency and region containment. Neither is
 * here yet: a `BoxId` is stable only within one shape, so the ids themselves
 * are meaningless downstream, and what a rule needs instead -- a boundary flag,
 * a region depth -- is a question the dump answers.
 */
export const STRUCTURE_KEYS = {
    side: `data-${COMPONENT}-side`,
} as const;

export type StructureKey = keyof typeof STRUCTURE_KEYS;

/**
 * Markers for pure styling: the surfaces a theme decorates.
 *
 * A third layer, distinct from the two above it. A part marker says what a node
 * *is*; {@link DATA_KEYS} carries the model data a consumer computes with. These
 * name the surfaces a border or a background is drawn on -- a right edge is a
 * right edge, and which edges a box presents is a fact about the card, not a
 * look.
 *
 * The card is flexbox, so none of this comes free. A table gives a consumer
 * `td:first-child` and `border-collapse`; CSS grid gives line numbers and named
 * areas. Nested divs give a rule the tag, the attributes, and sibling position,
 * and nothing else -- which group a box bounds is not derivable from the DOM.
 * Left unmarked, a consumer wanting correct borders would have to reconstruct
 * the card's graph from its markup.
 *
 * Empty until the structural layer lands and a stylesheet is written against a
 * real dump. What a theme actually needs to select on is a question the dump
 * answers; naming keys before then would be a guess.
 */
export const STYLE_KEYS = {} as const;

export type StyleKey = keyof typeof STYLE_KEYS;
