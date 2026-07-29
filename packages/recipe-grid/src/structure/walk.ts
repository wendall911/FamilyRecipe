/**
 * Walk a compiled recipe DAG into the render structure.
 *
 * The framework-neutral structure pass. Each {@link RecipeTreeNode} becomes a
 * tree of {@link StructureNode}s that fully describes the element tree: each node
 * carries its tag, a part marker (when it is a part), machine-readable `data-*`
 * attributes, semantic HTML attributes, the literal text of leaf nodes, the grid
 * extent, and children. It is a complete representation of the DOM to render, not
 * a partial one: every element that
 * must exist (a step's `inputs` column, a content `<p>`, a `quantity` span, the
 * inline text/`scaled-value` spans) is a real node here. A downstream renderer
 * (the built element tree, or a framework binding) turns this into elements with
 * no further structural decisions of its own.
 *
 * The grid extent is the space a node's subtree occupies when laid out like the
 * recipe table:
 *
 *   - rows    one per terminal (ingredient / reference). Steps do not add
 *             rows; a headed sub-recipe adds one row for its header.
 *   - columns a step is a column to the right of the widest of its inputs;
 *             terminals are one column. Sub-recipe headers do not add columns.
 *
 * A {@link Reference} transcludes its target: it occupies the rows and columns
 * of the sub-recipe it points at, because the referenced content is laid out
 * inline where the reference sits.
 */

import type {
    Ingredient,
    Quantity,
    Recipe,
    RecipeNumber,
    RecipeReference,
    RecipeTreeNode,
    Reference,
    Remainder,
    ScaledValueString,
    Step,
    SubRecipe,
} from '../model.ts';

import { DATA_KEYS, part, tagForPart, type RecipeGridPart } from './parts.ts';

/**
 * The space a node's subtree occupies in the recipe grid.
 */
export interface Extent {
    // Table rows spanned: one per terminal, plus one for a sub-recipe header.
    rows: number;
    // Table columns spanned: step depth plus the terminal column.
    columns: number;
}

/**
 * A node's render structure: the element to emit and its subtree.
 *
 * A node is either a part node (it carries a `data-recipe-grid-<part>` marker and
 * renders as the semantic tag for that part) or a plain element node (a bare
 * `<p>` or `<span>` with no marker, used for a content paragraph or a literal
 * text run). `tag` is the element to emit; for a part node it is the semantic tag
 * of the part, for a plain node it is set directly.
 */
export interface StructureNode {
    // The HTML tag to emit, e.g. 'div', 'p', 'h1', 'span', 'a'.
    tag: string;
    /*
     * The part marker attribute name (e.g. `data-recipe-grid-step`), when the
     * node is a part; absent on a plain `<p>` / `<span>` element node.
     */
    part?: `data-recipe-grid-${RecipeGridPart}`;
    // The core's `data-recipe-grid-*` bindings, keyed by attribute name.
    dataAttrs: Record<string, string>;
    /*
     * Semantic HTML attributes to set on the element (e.g. an `<a>`'s `title`),
     * keyed by attribute name. Distinct from `dataAttrs`: these are real HTML
     * attributes, not `data-*` bindings. Absent when the node sets none.
     */
    attrs?: Record<string, string>;
    // Literal text content, when this node is a text leaf; absent otherwise.
    text?: string;
    // The grid space this node's subtree occupies.
    extent: Extent;
    // The child nodes of this node.
    children: StructureNode[];
}

/*
 * A zero-size extent for the inline element nodes (paragraphs, spans) that carry
 * text rather than occupying grid cells of their own.
 */
const INLINE_EXTENT: Extent = { rows: 0, columns: 0 };

/**
 * The rows a node's subtree occupies: one per terminal, following a reference
 * into its target, plus one for a sub-recipe's heading.
 */
export function extentRows(node: RecipeTreeNode): number {
    switch (node.kind) {
        case 'ingredient':
            return 1;
        case 'reference':
            return extentRows(node.resolvedNode);
        case 'step':
            return node.inputs.reduce((n, input) => n + extentRows(input), 0);
        case 'subRecipe':
            /*
             * A sub-recipe always has a heading (a `:=` names one or more
             * outputs); that heading occupies one row above its subtree.
             */
            return extentRows(node.subTree) + 1;
        case 'recipeReference':
            return 1;
    }
}

/**
 * The columns a node's subtree occupies: a step is one column right of its
 * widest input; a reference occupies its target's columns; a header adds none.
 */
export function extentColumns(node: RecipeTreeNode): number {
    switch (node.kind) {
        case 'ingredient':
            return 1;
        case 'reference':
            return extentColumns(node.resolvedNode);
        case 'step':
            return 1 + Math.max(...node.inputs.map(extentColumns));
        case 'subRecipe':
            return extentColumns(node.subTree);
        case 'recipeReference':
            return 1;
    }
}

/**
 * The grid extent of a node's subtree.
 */
export function extentOf(node: RecipeTreeNode): Extent {
    return { rows: extentRows(node), columns: extentColumns(node) };
}

/**
 * Serialise a RecipeNumber for a `data-*` value, preserving exact fractions.
 */
function serializeValue(value: RecipeNumber): string {
    return JSON.stringify(value);
}

/**
 * A part node: the element for a `data-recipe-grid-<part>` marker.
 */
function partNode(
    name: RecipeGridPart,
    fields: Partial<Omit<StructureNode, 'tag' | 'part'>>,
): StructureNode {
    return {
        tag: tagForPart(part(name)),
        part: part(name),
        dataAttrs: {},
        extent: INLINE_EXTENT,
        children: [],
        ...fields,
    };
}

/**
 * A plain `<span>` text leaf: a bare span carrying a run of literal text, no
 * part marker.
 */
function textSpan(text: string): StructureNode {
    return { tag: 'span', dataAttrs: {}, text, extent: INLINE_EXTENT, children: [] };
}

/**
 * A `scaled-value` span: a marked span carrying a scalable number's base value
 * (so a runtime scaler can rescale it) plus the number as its text.
 */
function scaledValueSpan(value: RecipeNumber): StructureNode {
    return partNode('scaled-value', {
        dataAttrs: { [DATA_KEYS.value]: serializeValue(value) },
        text: String(value),
    });
}

/**
 * True when a ScaledValueString piece is a scalable number (vs literal text).
 */
function isNumberPiece(
    piece: ScaledValueString[number],
): piece is Exclude<ScaledValueString[number], string> {
    return typeof piece !== 'string';
}

/**
 * The inline children of a scale-aware string: each literal run becomes a plain
 * `<span>` text leaf, each scalable number a marked `scaled-value` span.
 */
function inlineContent(text: ScaledValueString): StructureNode[] {
    return text.map((piece) =>
        isNumberPiece(piece) ? scaledValueSpan(piece) : textSpan(piece),
    );
}

/**
 * A quantity as a `quantity` span: its value (scalable) plus unit/preposition
 * text as a trailing plain span when present.
 */
function quantityNode(quantity: Quantity): StructureNode {
    const children: StructureNode[] = [scaledValueSpan(quantity.value)];
    const unitText =
        quantity.unitOfMeasure !== null ? `${quantity.valueUnitSpacing}${quantity.unitOfMeasure}` : '';
    const trailing = `${unitText}${quantity.preposition}`;
    if (trailing !== '') {
        children.push(textSpan(trailing));
    }
    return partNode('quantity', { children });
}

/**
 * The inline nodes rendering a node's carried quantity and text, if any: the
 * quantity span first, then the text runs.
 */
function contentNodes(text?: ScaledValueString, quantity?: Quantity): StructureNode[] {
    const out: StructureNode[] = [];
    if (quantity !== undefined) {
        out.push(quantityNode(quantity));
    }
    if (text !== undefined) {
        out.push(...inlineContent(text));
    }
    return out;
}

/**
 * A content `<p>`: the paragraph wrapping a node's carried text/quantity. Only
 * emitted when the content produces inline nodes.
 */
function contentParagraph(children: StructureNode[]): StructureNode {
    return { tag: 'p', dataAttrs: {}, extent: INLINE_EXTENT, children };
}

function walkIngredient(node: Ingredient): StructureNode {
    const dataAttrs: Record<string, string> = {};
    if (node.quantity !== null) {
        dataAttrs[DATA_KEYS.value] = serializeValue(node.quantity.value);
    }
    const inline = contentNodes(node.description, node.quantity ?? undefined);
    return partNode('ingredient', {
        dataAttrs,
        extent: extentOf(node),
        children: inline.length > 0 ? [contentParagraph(inline)] : [],
    });
}

function walkStep(node: Step): StructureNode {
    /*
     * A step is the bracket: its inputs form a column on the left, its action
     * (label) sits to the right. Emit inputs-then-label so DOM order matches
     * reading order (inputs -> action), which the flex layout and a later ARIA
     * pass both rely on.
     */
    const children: StructureNode[] = [
        partNode('inputs', { children: node.inputs.map(walk) }),
    ];
    const label = contentNodes(node.description);
    if (label.length > 0) {
        children.push(contentParagraph(label));
    }
    return partNode('step', { extent: extentOf(node), children });
}

function walkReference(node: Reference): StructureNode {
    const dataAttrs: Record<string, string> = {};
    if (node.amount !== undefined && node.amount.kind === 'quantity') {
        dataAttrs[DATA_KEYS.value] = serializeValue(node.amount.value);
    }
    const children: StructureNode[] = [];
    /*
     * A remainder amount ("use the rest") is its own block-level `remainder`
     * part (a <div>), emitted before the transcluded body so the "Remaining"
     * wording reads ahead of it. It carries no value (a remainder has none —
     * the ingredient list is the definitive amount) and no scale-aware pieces,
     * so it is a single literal-text node: the <div> holds one <p> whose text
     * is the wording, built inline (not via the content-node helpers, which
     * exist for the composite ingredient/step cases).
     */
    if (node.amount !== undefined && node.amount.kind === 'remainder') {
        children.push(
            partNode('remainder', {
                children: [
                    { tag: 'p', dataAttrs: {}, extent: INLINE_EXTENT, text: node.amount.wording, children: [] },
                ],
            }),
        );
    }
    /*
     * A reference transcludes its target: the resolved node's full structure
     * (an ingredient, or a step with its own inputs) renders inline where the
     * reference sits; the referenced body appears in place, not a bare pointer.
     * The reference keeps its own part marker and any amount; the target's body
     * is its child.
     */
    children.push(walk(node.resolvedNode));
    return partNode('reference', {
        dataAttrs,
        extent: extentOf(node),
        children,
    });
}

function walkRecipeReference(node: RecipeReference): StructureNode {
    /*
     * A cross-file link is a bare <a>: its only content is the link text, which
     * sits directly on the anchor (no wrapping <p> or <span>). Its `targetSlug`
     * rides through as a data binding for the consumer to resolve into whatever
     * link they need; its `title`, when authored, is a real HTML attribute. It
     * has no children; it is a leaf, not a transclusion.
     */
    const structureNode = partNode('recipe-reference', {
        dataAttrs: { [DATA_KEYS.targetSlug]: node.targetSlug },
        text: node.name,
        extent: extentOf(node),
    });
    if (node.title !== undefined) {
        structureNode.attrs = { title: node.title };
    }
    return structureNode;
}

function walkSubRecipe(node: SubRecipe): StructureNode {
    /*
     * A sub-recipe always has a heading (its `:=` output name); emit it above
     * the sub-recipe's tree. The heading carries its text inline directly (it is
     * an <h2>), with no wrapping <p>.
     */
    const header = partNode('sub-recipe-header', {
        extent: { rows: 1, columns: extentColumns(node.subTree) },
        children: inlineContent(node.outputNames[0]),
    });
    return partNode('sub-recipe', {
        extent: extentOf(node),
        children: [header, walk(node.subTree)],
    });
}

/**
 * Map a single recipe tree node to its render structure.
 */
export function walk(node: RecipeTreeNode): StructureNode {
    switch (node.kind) {
        case 'ingredient':
            return walkIngredient(node);
        case 'step':
            return walkStep(node);
        case 'reference':
            return walkReference(node);
        case 'subRecipe':
            return walkSubRecipe(node);
        case 'recipeReference':
            return walkRecipeReference(node);
    }
}

/**
 * Collect every sub-recipe referenced by a node's subtree. A referenced
 * sub-recipe is laid out inline where it is referenced, so its rows are already
 * counted inside the referencing tree and must not be counted again at the root.
 */
function collectReferenced(node: RecipeTreeNode, into: Set<RecipeTreeNode>): void {
    switch (node.kind) {
        case 'reference':
            into.add(node.resolvedNode);
            collectReferenced(node.resolvedNode, into);
            return;
        case 'step':
            node.inputs.forEach((input) => collectReferenced(input, into));
            return;
        case 'subRecipe':
            collectReferenced(node.subTree, into);
            return;
        case 'ingredient':
        case 'recipeReference':
            return;
    }
}

/**
 * The render structure of a whole recipe: the root, carrying its scaling
 * metadata, wrapping the grid of mapped recipe trees.
 */
export function walkRecipe(recipe: Recipe): StructureNode {
    /*
     * Trees referenced by another tree are transcluded where referenced; only
     * the trees no other tree references are independent roots of the layout. A
     * referenced target may be a SubRecipe (`:=`) or an `=`-labelled Ingredient/
     * Step, so any referenced root is excluded, not just SubRecipe ones.
     */
    const referenced = new Set<RecipeTreeNode>();
    recipe.recipeTrees.forEach((t) => collectReferenced(t, referenced));
    const roots = recipe.recipeTrees.filter((t) => !referenced.has(t));

    const gridExtent: Extent = {
        rows: roots.reduce((n, t) => n + extentRows(t), 0),
        columns: Math.max(...roots.map(extentColumns)),
    };
    /*
     * Render only the unreferenced roots; referenced trees (ingredient
     * declarations, `,action` steps, sub-recipes) are transcluded inline at
     * their use site, not repeated as top-level grid children.
     */
    const grid = partNode('grid', { extent: gridExtent, children: roots.map(walk) });

    const dataAttrs: Record<string, string> = {
        [DATA_KEYS.scalingType]: recipe.scalingType,
    };
    if (recipe.base !== undefined) {
        dataAttrs[DATA_KEYS.base] = serializeValue(recipe.base);
    }

    return partNode('root', { dataAttrs, extent: gridExtent, children: [grid] });
}
