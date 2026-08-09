/**
 * Part vocabulary and attribute conventions for the framework-neutral render
 * structure.
 *
 * The single source of truth for how a rendered recipe grid is named. Three
 * layers of attribute, and the `data-` prefix is what tells them apart:
 *
 *   {@link PART_ATTRS}       `data-recipe-grid-<part>` -- what a node is. Every
 *                            element the core emits carries one, as a
 *                            class-free styling/query hook.
 *   {@link DATA_KEYS}        `data-recipe-grid-*` -- the model data a consumer
 *                            computes with: a scalable value, a unit key, a
 *                            target slug, the recipe's scaling. A runtime
 *                            binding that rescales reactively and a static
 *                            renderer that emits each scale ahead of time read
 *                            the same markup.
 *   {@link STRUCTURE_KEYS},  `recipe-grid-*`, no prefix -- where a box sits and
 *   {@link STYLE_KEYS}       which edges it presents. A rule matches on these
 *                            and takes nothing away, so they carry no `data-`.
 *
 * This module names things only: the attributes above, and the semantic HTML
 * tag each part renders as. It emits no DOM and computes no values.
 */

const COMPONENT = 'recipe-grid';

/**
 * The parts of a rendered recipe grid. Each maps to a `data-recipe-grid-<part>`
 * marker attribute.
 *
 * - `root`              the recipe container (one per recipe).
 * - `card`              the region that lays out the recipe trees.
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
 * - `uomID`       on a `quantity` element: the canonical unit-of-measure key
 *                 the authored unit resolved to ("cloves" -> "clove", "g" ->
 *                 "gram"), the handle a consumer converts with. Emitted
 *                 alongside the authored unit, which renders as text, never
 *                 instead of it. Absent on a unit-less count, where the model
 *                 carries no identity to emit.
 * - `scalingType` on the root: 'servings' | 'fixed'.
 * - `base`        on the root: the as-authored base to scale from.
 * - `unitSystem`  on the root: the measurement system the authored quantities
 *                 are read in, 'us' | 'imperial' | 'metric'.
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
    uomID: `data-${COMPONENT}-uom-id`,
    scalingType: `data-${COMPONENT}-scaling-type`,
    base: `data-${COMPONENT}-base`,
    unitSystem: `data-${COMPONENT}-unit-system`,
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
 * - `flow`   which way this box lays its children out: `row`, `column`, or
 *            `leaf` when it has none. What `side` is to a box's parent, this is
 *            to its children.
 *
 *            A rule that cares which way a box flows selects on this rather
 *            than on the part marker. Without it, a consumer has to carry the
 *            part-to-flow mapping themselves -- `card`, `inputs`,
 *            `sub-recipe`, `sub-recipe-body` and `reference` are columns,
 *            `step` is a row -- and re-check it whenever a part is added. That
 *            is a table to memorise where the markup could just say it, and it
 *            is the fact {@link STYLE_KEYS}'s `edge` is read against: a rule
 *            pairs the parent's flow with the child's edge to know which side
 *            a line belongs on.
 *
 * No `data-` prefix, unlike {@link DATA_KEYS}. That prefix says "read this" --
 * a value a consumer computes with. Nothing reads these: a rule matches on them
 * and takes nothing away. The prefix's absence is the distinction, so a theme
 * author can tell a selector hook from a binding by looking at it.
 *
 * The shape pass also resolves region containment. It is not here: a `RegionId`
 * is stable only within one shape, so the ids themselves are meaningless
 * downstream, and what a rule needs instead -- a region depth, a membership
 * flag -- is a question the dump answers.
 */
export const STRUCTURE_KEYS = {
    side: `${COMPONENT}-side`,
    flow: `${COMPONENT}-flow`,
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
 * - `edge`  which of a box's own edges are its container's rather than a line
 *           between it and a neighbour: `start`, `end`, `both`, or absent when
 *           the box has a neighbour on each side. The shape pass resolved this
 *           as adjacency; a `BoxId` is meaningless downstream, so what crosses
 *           is the fact a rule needs, not the ids it came from.
 *
 *           The edges named are along the parent's flow: in a row, start is
 *           left and end is right; in a column, start is top and end is
 *           bottom. The parent carries its own flow (see
 *           {@link STRUCTURE_KEYS}), so a rule pairs the two: the parent's
 *           flow says which axis, this says which end of it.
 *
 *           This is what a theme draws a group's boundary with. A card's
 *           outermost row, a region's body, the last input in a column -- each
 *           has an edge that is the container's, and a border there bounds the
 *           group rather than dividing two of its members.
 *
 * No `data-` prefix, for the same reason {@link STRUCTURE_KEYS} has none: these
 * are matched, not read.
 */
export const STYLE_KEYS = {
    edge: `${COMPONENT}-edge`,
} as const;

export type StyleKey = keyof typeof STYLE_KEYS;
