/**
 * Fill the card's shape with content.
 *
 * The second extract pass. `extract-shape.ts` decided what nests inside what
 * and on which side; this pass never asks a structural question. It walks the
 * finished box tree and gives each box what it renders as: a tag, a part
 * marker, the machine-readable `data-*` bindings, the semantic HTML attributes
 * the node sets, and the literal text of a leaf.
 *
 * What comes out is a complete element tree, not a sketch of one. Every element
 * the DOM needs is a real {@link StructureNode} here -- the inline pieces a box
 * expands into as much as the boxes themselves: a `quantity` span, a
 * `scaled-value` span for each number that rescales, the literal text around
 * them. A downstream renderer (the built element tree, or a framework binding)
 * turns this into elements and makes no structural decision of its own.
 *
 * A box carries its model node by reference. Content is read straight off it:
 * a Step's description, an Ingredient's description and quantity, a
 * SubRecipe's output names, a RecipeReference's name and target slug, a
 * Remainder's wording. The node is never copied and never rewritten -- whatever
 * the DAG holds is what gets rendered.
 *
 * No arithmetic, no resolution, no validation. A scalable number is emitted
 * with its authored value for a consumer to multiply; a cross-file link is
 * emitted with its slug for a consumer to resolve. Both are the consumer's
 * move, and the core does not make it for them.
 */

/*
 * The pieces of the model this pass renders. The import list is the checklist:
 * each one should be reached by a function in this file.
 */
import type {
    Ingredient,
    Quantity,
    RecipeMeta,
    RecipeNumber,
    RecipeReference,
    Reference,
    Remainder,
    ScaledValueString,
    Step,
    SubRecipe,
} from '../model.ts';

import type {
    Box,
    BoxId,
    CardShape,
    Flow,
    Region,
    Side,
} from './extract-shape.ts';

import {
    DATA_KEYS,
    STRUCTURE_KEYS,
    STYLE_KEYS,
    part,
    tagForPart,
    type RecipeGridPart,
} from './parts.ts';

/**
 * A node's render structure: the element to emit and its subtree.
 *
 * A node is either a part node (it carries a `data-recipe-grid-<part>` marker
 * and renders as the semantic tag for that part) or a plain element node (a
 * bare `<p>` or `<span>` with no marker, used for a content paragraph or a
 * literal text run). `tag` is the element to emit; for a part node it is the
 * semantic tag of the part, for a plain node it is set directly.
 *
 * The render structure: part-tagged nodes for a binding to render as
 * components.
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
    // The child nodes of this node.
    children: StructureNode[];
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
        children: [],
        ...fields,
    };
}

/**
 * A plain `<span>` text leaf: a bare span carrying a run of literal text, no
 * part marker.
 */
function textSpan(text: string): StructureNode {
    return {
        tag: 'span',
        dataAttrs: {},
        text,
        children: [],
    };
}

/**
 * A number as the card draws it, in the form the author wrote.
 *
 * A `RecipeNumber` is a JS number for a whole number or a decimal, or a
 * `Fraction` for an exact fraction. The authored form is what renders: `1/2`
 * stays a fraction and `0.5` stays a decimal, though both are the same
 * magnitude.
 */
function numberText(value: RecipeNumber): string {
    return typeof value === 'number'
        ? String(value)
        : `${value.numerator}/${value.denominator}`;
}

/**
 * A `scaled-value` span: a marked span carrying a scalable number's base value
 * (so a runtime scaler can rescale it) plus the number as its text.
 *
 * The base value is the `RecipeNumber` itself, serialised whole. A fraction is
 * not flattened to a decimal, so an exact amount survives rescaling.
 */
function scaledValueSpan(value: RecipeNumber): StructureNode {
    return partNode('scaled-value', {
        dataAttrs: { [DATA_KEYS.value]: JSON.stringify(value) },
        text: numberText(value),
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
 *
 * The canonical unit identity rides on the span as a binding. The authored unit
 * is what renders; the identity is the handle a consumer converts with, so both
 * are carried and neither replaces the other. A unit-less count has no identity
 * to emit, so the binding is absent exactly when the authored unit is.
 */
function quantityNode(quantity: Quantity): StructureNode {
    const children: StructureNode[] = [scaledValueSpan(quantity.value)];
    const unitText =
        quantity.unitOfMeasure !== null
            ? `${quantity.valueUnitSpacing}${quantity.unitOfMeasure}`
            : '';
    const trailing = `${unitText}${quantity.preposition}`;
    const dataAttrs: Record<string, string> = {};

    if (quantity.unitOfMeasureID !== null) {
        dataAttrs[DATA_KEYS.uomID] = quantity.unitOfMeasureID;
    }

    if (trailing !== '') {
        children.push(textSpan(trailing));
    }

    return partNode('quantity', { dataAttrs, children });
}

/**
 * The inline nodes rendering a node's carried quantity and text, if any: the
 * quantity span first, then the text runs.
 */
function contentNodes(
    text?: ScaledValueString,
    quantity?: Quantity,
): StructureNode[] {
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
    return {
        tag: 'p',
        dataAttrs: {},
        children,
    };
}

/**
 * The lone literal text run a node's content amounts to, when it is nothing
 * else.
 *
 * A single unmarked run needs no element of its own: the node it sits in is
 * already the element, and a span around it marks nothing a rule can reach.
 * Anything else -- a marked span, a run beside a sibling -- stands as it is.
 */
function loneText(inline: StructureNode[]): string | undefined {
    const only = inline.length === 1 ? inline[0] : undefined;

    return only !== undefined &&
        only.part === undefined &&
        only.children.length === 0
        ? only.text
        : undefined;
}

/**
 * The content of a box that carries text and, optionally, a quantity: a single
 * content `<p>`, or nothing when the node carries neither.
 *
 * A paragraph whose whole content is one literal run carries that text itself,
 * with no span between the two.
 */
function contentChildren(
    text?: ScaledValueString,
    quantity?: Quantity,
): StructureNode[] {
    const inline = contentNodes(text, quantity);

    if (inline.length === 0) {
        return [];
    }

    const lone = loneText(inline);

    return lone !== undefined
        ? [{ tag: 'p', dataAttrs: {}, text: lone, children: [] }]
        : [contentParagraph(inline)];
}

/**
 * The recipe's scaling, as bindings on the root.
 *
 * Recipe-level rather than box-level: the whole card scales together, so this
 * rides the root above it rather than any box within it. A consumer reads it
 * there, before descending into the card it describes. `base` is a
 * {@link RecipeNumber} and is serialised whole, the way a scalable value is --
 * an exact fraction stays exact. Absent when the recipe authored none.
 */
function scalingAttrs(meta: RecipeMeta): Record<string, string> {
    const attrs: Record<string, string> = {
        [DATA_KEYS.scalingType]: meta.scalingType,
    };

    if (meta.base !== undefined) {
        attrs[DATA_KEYS.base] = JSON.stringify(meta.base);
    }

    return attrs;
}

/**
 * The flexbox facts a box carries into the DOM: where it sits, and which way it
 * lays its own children out.
 *
 * Every node that is a box gets these -- not the inline pieces a box expands
 * into, which have no position in the card to describe. They are what a rule
 * targets a box by when the part marker is not enough: the inputs column and a
 * region's body have no part of their own.
 *
 * `side` is what the box is to its parent; `flow` is what it is to its
 * children. A rule needing both -- which axis a line lies on, and which end of
 * it -- reads `flow` from the parent and `edge` from the child, so neither has
 * to be recovered from the part marker.
 *
 * `edge` rides along: which of the box's own edges are its container's rather
 * than a line between it and a neighbour. It is a styling marker rather than a
 * layout fact, and it is emitted here because this is where a box's own
 * position is read.
 */
function structureAttrs(box: Box): Record<string, string> {
    const attrs: Record<string, string> = {
        [STRUCTURE_KEYS.side]: box.side,
        [STRUCTURE_KEYS.flow]: box.flow,
    };
    const edge = edgeOf(box);

    if (edge !== undefined) {
        attrs[STYLE_KEYS.edge] = edge;
    }

    return attrs;
}

/**
 * Which of a box's own edges are its container's, along its parent's flow.
 *
 * A box with nothing before it presents the container's leading edge; nothing
 * after it, the trailing one; a box alone in its parent presents both. A box
 * with a neighbour on each side presents neither, and carries no marker --
 * every edge it has is a line between two members of the group.
 */
function edgeOf(box: Box): string | undefined {
    const start = box.touches.before === null;
    const end = box.touches.after === null;

    if (start && end) return 'both';
    if (start) return 'start';
    if (end) return 'end';

    return undefined;
}

/**
 * An ingredient leaf: its quantity and description, in a content `<p>`.
 *
 * The quantity's base value and unit identity also ride on the ingredient
 * itself, so a consumer reading the ingredient does not have to descend into
 * the inline spans to find what scales and what it converts with. Converting
 * before scaling needs both together, and this is where an ingredient is
 * reached.
 */
function ingredientNode(box: Box, node: Ingredient): StructureNode {
    const dataAttrs: Record<string, string> = structureAttrs(box);

    if (node.quantity !== null) {
        dataAttrs[DATA_KEYS.value] = JSON.stringify(node.quantity.value);

        if (node.quantity.unitOfMeasureID !== null) {
            dataAttrs[DATA_KEYS.uomID] = node.quantity.unitOfMeasureID;
        }
    }

    return partNode('ingredient', {
        dataAttrs,
        children: contentChildren(node.description, node.quantity ?? undefined),
    });
}

/**
 * A cross-file link: a bare `<a>` carrying the link text directly.
 *
 * `targetSlug` rides through as a data binding for the consumer to resolve into
 * whatever link they need -- an in-page jump, a route, an external URL, or
 * nothing at all. The core does not know which, so it emits no href. `title`,
 * when the author wrote one, is a real HTML attribute.
 */
function recipeReferenceNode(box: Box, node: RecipeReference): StructureNode {
    const structureNode = partNode('recipe-reference', {
        dataAttrs: {
            ...structureAttrs(box),
            [DATA_KEYS.targetSlug]: node.targetSlug,
        },
        text: node.name,
    });

    if (node.title !== undefined) {
        structureNode.attrs = { title: node.title };
    }

    return structureNode;
}

/**
 * A step's action leaf: the action text the step is named by, in a content
 * `<p>`.
 *
 * The step's row box and this leaf carry the same {@link Step}; `side` is what
 * tells them apart. The row is the bracket -- the `step` part -- and this is the
 * action beside it, which is a part of its own so a rule can reach one without
 * the other.
 */
function actionNode(box: Box, node: Step): StructureNode {
    return partNode('action', {
        dataAttrs: structureAttrs(box),
        children: contentChildren(node.description),
    });
}

/**
 * A sub-recipe's header band: the declared output name, inline on the `<h2>`.
 *
 * The heading carries its text directly, with no wrapping `<p>`. A name that is
 * one literal run sits on the heading itself; a name with a scalable number in
 * it keeps the inline spans that mark it.
 */
function subRecipeHeaderNode(box: Box, node: SubRecipe): StructureNode {
    const inline = inlineContent(node.outputNames[0]);
    const lone = loneText(inline);

    return partNode('sub-recipe-header', {
        dataAttrs: structureAttrs(box),
        ...(lone !== undefined ? { text: lone } : { children: inline }),
    });
}

/**
 * A reference's draw: the amount a use site asked for, wrapping the target it
 * transcludes.
 *
 * The reference's own box carries the draw; its child box is the target, whose
 * structure stands here. The amount is a {@link Quantity} when the line restated
 * a measure, a {@link Remainder} when it asked for the rest, and absent when the
 * line named the output with no amount at all.
 *
 * The amount rides the edge because a shared node is reached from more than one
 * place and each use draws its own, so it is emitted here rather than on the
 * target. It is emitted as authored -- the value in the form it was written, the
 * unit and preposition with their spacing -- because the DOM has to carry back
 * to the markdown it came from.
 */
function referenceNode(
    box: Box,
    node: Reference,
    children: StructureNode[],
): StructureNode {
    const amount = node.amount;
    const draw =
        amount === undefined
            ? []
            : amount.kind === 'quantity'
              ? [quantityNode(amount)]
              : [remainderNode(amount)];

    return partNode('reference', {
        dataAttrs: structureAttrs(box),
        children: [...draw, ...children],
    });
}

/**
 * A "use the rest" note: the remainder wording, as authored.
 *
 * It carries no value: the ingredient list is the definitive amount, and what is
 * left after earlier draws is a validation question the compiler does not
 * answer. The wording is what the card reads; `preposition` survives as
 * authored, leading space and all.
 *
 * Both are literal text, so neither is a `scaled-value` -- there is nothing here
 * that rescales. The two run together as one string, the way the line was
 * written.
 */
function remainderNode(amount: Remainder): StructureNode {
    return partNode('remainder', {
        text: `${amount.wording}${amount.preposition}`,
    });
}

/**
 * The structure node for one box, and everything under it.
 *
 * Dispatch is on the box, not the model: `side` first, because a step's row box
 * and its action leaf carry the same node, as do a sub-recipe's region box and
 * its header. Children are always the box's children -- the model is never
 * recursed into, because the shape pass already did that.
 */
function nodeForBox(shape: CardShape, meta: RecipeMeta, id: BoxId): StructureNode {
    const box = shape.boxes[id];
    const children = (): StructureNode[] =>
        box.children.map((child) => nodeForBox(shape, meta, child));

    /*
     * A grouping box the model has no node for. Which one it is comes from
     * `side`: the card itself, a step's inputs column, or a region's body.
     */
    if (box.node === null) {
        switch (box.side) {
            case 'root':
                return partNode('card', {
                    dataAttrs: structureAttrs(box),
                    children: children(),
                });
            case 'inputs':
                return partNode('inputs', {
                    dataAttrs: structureAttrs(box),
                    children: children(),
                });
            default:
                // A sub-recipe's body: everything under the header band.
                return partNode('sub-recipe-body', {
                    dataAttrs: structureAttrs(box),
                    children: children(),
                });
        }
    }

    if (box.side === 'action') {
        return actionNode(box, box.node as Step);
    }

    if (box.side === 'header') {
        return subRecipeHeaderNode(box, box.node as SubRecipe);
    }

    switch (box.node.kind) {
        case 'ingredient':
            return ingredientNode(box, box.node);
        case 'recipeReference':
            return recipeReferenceNode(box, box.node);
        case 'step':
            return partNode('step', {
                dataAttrs: structureAttrs(box),
                children: children(),
            });
        case 'subRecipe':
            return partNode('sub-recipe', {
                dataAttrs: structureAttrs(box),
                children: children(),
            });
        case 'reference':
            /*
             * The reference's box wraps the target it transcludes: the draw the
             * use site made, then the target's own structure beneath it.
             */
            return referenceNode(box, box.node, children());
    }
}

/**
 * The recipe's render structure: the root container holding the filled card.
 *
 * The root is not a box. The shape pass resolved boxes -- what nests inside what
 * and on which side -- and the card is the outermost of them. The root sits
 * above that: the container a consumer mounts, hangs the recipe's metadata on,
 * and decides the element for. It carries no structural attributes because it
 * has no position in the card to describe.
 */
export function extractStructure(
    shape: CardShape,
    meta: RecipeMeta,
): StructureNode {
    return partNode('root', {
        dataAttrs: scalingAttrs(meta),
        children: [nodeForBox(shape, meta, shape.root)],
    });
}
