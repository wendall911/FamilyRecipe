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
    Fraction,
    Ingredient,
    Quantity,
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
 */
function quantityNode(quantity: Quantity): StructureNode {
    const children: StructureNode[] = [scaledValueSpan(quantity.value)];
    const unitText =
        quantity.unitOfMeasure !== null
            ? `${quantity.valueUnitSpacing}${quantity.unitOfMeasure}`
            : '';
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
 * The content of a box that carries text and, optionally, a quantity: a single
 * content `<p>`, or nothing when the node carries neither.
 */
function contentChildren(
    text?: ScaledValueString,
    quantity?: Quantity,
): StructureNode[] {
    const inline = contentNodes(text, quantity);

    return inline.length > 0 ? [contentParagraph(inline)] : [];
}

/**
 * The flexbox facts a box carries into the DOM: where it sits in the card.
 *
 * Every emitted node gets these, whether or not it is a part. They are what a
 * rule targets a box by when the part marker is not enough -- the inputs column
 * and a region's body have no part of their own.
 */
function structureAttrs(box: Box): Record<string, string> {
    return { [STRUCTURE_KEYS.side]: box.side };
}

/**
 * An ingredient leaf: its quantity and description, in a content `<p>`.
 *
 * The quantity's base value also rides on the ingredient itself, so a consumer
 * reading the ingredient does not have to descend into the inline spans to find
 * what scales.
 */
function ingredientNode(box: Box, node: Ingredient): StructureNode {
    const dataAttrs: Record<string, string> = structureAttrs(box);

    if (node.quantity !== null) {
        dataAttrs[DATA_KEYS.value] = JSON.stringify(node.quantity.value);
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
 * The heading carries its text directly, with no wrapping `<p>`.
 */
function subRecipeHeaderNode(box: Box, node: SubRecipe): StructureNode {
    return partNode('sub-recipe-header', {
        dataAttrs: structureAttrs(box),
        children: inlineContent(node.outputNames[0]),
    });
}

/**
 * An exact fraction as the card draws it.
 *
 * Not yet reached: {@link numberText} handles both {@link RecipeNumber} arms by
 * structural check rather than naming this one. Splitting it out is what a
 * fraction-aware rendering (a proper vulgar fraction, a `<sup>`/`<sub>` pair)
 * would hang off.
 */
function fractionText(value: Fraction): string {
    return `${value.numerator}/${value.denominator}`;
}

/**
 * A reference's draw: the amount a use site asked for.
 *
 * Not yet reached. The shape pass gives a reference no box -- it transcludes its
 * target, so what stands at the use site is the target's own boxes. The amount
 * the reference carried has nowhere to attach, and vanishes.
 *
 * A reference's amount is a {@link Quantity} when the line restated a measure,
 * a {@link Remainder} when it asked for the rest, and absent when the line named
 * the output with no amount at all. Where each lands in the DOM is the open
 * question: it wants a dump, not a decision made here.
 */
function referenceNode(_node: Reference): StructureNode {
    throw new Error('referenceNode: not implemented');
}

/**
 * A "use the rest" note: the remainder wording, as authored.
 *
 * Not yet reached, for the same reason as {@link referenceNode} -- a remainder
 * lives on a reference's amount, and a reference has no box.
 *
 * It carries no value: the ingredient list is the definitive amount, and what is
 * left after earlier draws is a validation question the compiler does not
 * answer. The wording is what the card reads; `preposition` survives as
 * authored, leading space and all.
 */
function remainderNode(_amount: Remainder): StructureNode {
    throw new Error('remainderNode: not implemented');
}

/**
 * The structure node for one box, and everything under it.
 *
 * Dispatch is on the box, not the model: `side` first, because a step's row box
 * and its action leaf carry the same node, as do a sub-recipe's region box and
 * its header. Children are always the box's children -- the model is never
 * recursed into, because the shape pass already did that.
 */
function nodeForBox(shape: CardShape, id: BoxId): StructureNode {
    const box = shape.boxes[id];
    const children = (): StructureNode[] =>
        box.children.map((child) => nodeForBox(shape, child));

    /*
     * A grouping box the model has no node for. Which one it is comes from
     * `side`: the card itself, a step's inputs column, or a region's body.
     */
    if (box.node === null) {
        switch (box.side) {
            case 'root':
                return partNode('root', {
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
             * The shape pass gives a reference no box of its own: it transcludes
             * its target, so what stands here is the target. Unreachable.
             */
            return partNode('reference', {
                dataAttrs: structureAttrs(box),
                children: children(),
            });
    }
}

/**
 * The card's render structure: every box filled with what it renders as.
 */
export function extractStructure(shape: CardShape): StructureNode {
    return nodeForBox(shape, shape.root);
}
