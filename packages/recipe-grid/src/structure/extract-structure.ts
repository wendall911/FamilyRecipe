/**
 * Extract the full structure from the compiled DAG.
 *
 * `extract-shape.ts` provides the nesting and sides. This extract pass walks
 * the finished box tree and gives each box what it renders as: a tag, a part
 * marker, the machine-readable `data-*` bindings, the semantic HTML attributes
 * the node sets, and the literal text of a leaf.
 *
 * This provides the complete element tree. Every element the DOM needs is a
 * real {@link StructureNode}. A downstream renderer turns this into elements
 * and makes no structural decision of its own.
 *
 * No arithmetic, no resolution, no validation.
 */

import Fraction from 'fraction.js';

import type {
    Amount,
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
 * The render structure: part-tagged nodes for a binding to render as
 * components.
 * 
 * A node is one of three things. A part node carries a
 * `data-recipe-grid-<part>` marker and renders as the semantic tag for that
 * part. A plain element node is a bare `<p>` with no marker. A text node has no
 * `tag` at all.
 */
export interface StructureNode {
    tag?: string;
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
 * A text node: a run of literal text, with no element around it.
 */
function textNode(text: string): StructureNode {
    return {
        dataAttrs: {},
        text,
        children: [],
    };
}

/**
 * Sibling elements that have a `RecipeGridPart`. For example, a
 * scaled value, description, or quantity's unit name.
 */
function markedElement(text: string, name: RecipeGridPart): StructureNode {
    return partNode(
        name,
        {
            text
        }
    );
}

/**
 * A number as the card draws it, in the form the author wrote.
 *
 * A `RecipeNumber` is a JS number for a whole number or a decimal, or a
 * `Fraction` for an exact fraction. The authored form is what renders: `1/2`
 * stays a fraction and `0.5` stays a decimal, though both are the same
 * magnitude. Alternatively if an author wants conversions to always be
 * a fractional value, they can author 3/1 and initial display will be 3
 * while it remains a fraction in the data binding.
 */
function numberText(value: RecipeNumber): string {
    if (typeof value === 'number') {
        return String(value);
    }

    return new Fraction(value.numerator, value.denominator).toFraction(true);
}

/**
 * A `scaled-value`: a marked element carrying a scalable number's base value
 * (so a runtime scaler can rescale it) plus the number as its text.
 *
 * The base value is the `RecipeNumber` itself, serialised whole. A fraction is
 * not flattened to a decimal, so an exact amount survives rescaling.
 */
function scaledValue(value: RecipeNumber): StructureNode {
    return partNode('scaled-value', {
        dataAttrs: {
            [DATA_KEYS.value]: JSON.stringify(value)
        },
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
 * The children of an element, gathered in the order the author wrote them.
 */
interface Bag {
    // Add a run of literal text, as a child of its own.
    text: (run: string) => void;
    // Add an element.
    node: (node: StructureNode) => void;
    // The children gathered, in order.
    done: () => StructureNode[];
}

function bag(): Bag {
    const out: StructureNode[] = [];

    return {
        text: (run) => {
            if (run !== '') {
                out.push(textNode(run));
            }
        },
        node: (node) => {
            out.push(node);
        },
        done: () => out,
    };
}

/**
 * A quantity, into the bag its paragraph is gathering: the value as a
 * `scaled-value` span, then the pieces the author wrote after it, in order.
 */
function quantityInto(into: Bag, quantity: Quantity): void {
    into.node(scaledValue(quantity.value));

    for (const piece of quantity.parts) {
        into.text(piece.leading);

        if (piece.isUnitName === true) {
            into.node(markedElement(piece.text, 'uom-name'));
        }
        else {
            into.text(piece.text);
        }
    }
}

/**
 * A scale-aware string placed inline. 
 */
function inlineInto(
    into: Bag,
    text: ScaledValueString,
    name?: RecipeGridPart,
): void {
    text.forEach((piece, i) => {
        if (isNumberPiece(piece)) {
            into.node(scaledValue(piece));

            const next = text[i + 1];

            if (next !== undefined && !isNumberPiece(next)) {
                into.text(' ');
            }
        }
        else if (name !== undefined) {
            into.node(markedElement(piece, name));
        }
        else {
            into.text(piece);
        }
    });
}

/**
 * The content of a box that carries text and, optionally, a quantity: a single
 * content `<p>`, or nothing when the node carries neither.
 */
function contentChildren(
    text?: ScaledValueString,
    quantity?: Quantity,
    name?: RecipeGridPart,
    draw?: Quantity,
): StructureNode[] {
    const into = bag();

    if (draw !== undefined) {
        quantityInto(into, draw);
        into.text(' / ');
    }

    if (quantity !== undefined) {
        quantityInto(into, quantity);
    }

    if (text !== undefined) {
        if (quantity !== undefined) {
            into.text(' ');
        }

        inlineInto(into, text, name);
    }

    const children = into.done();

    return children.length === 0
        ? []
        : [{ tag: 'p', dataAttrs: {}, children }];
}

/**
 * The recipe's scaling, as bindings on the root.
 *
 * Recipe-level rather than box-level: the whole card scales together, so this
 * rides the root above it rather than any box within it. A consumer reads it
 * there, before descending into the card it describes. `base` is a
 * {@link RecipeNumber} and is serialised whole, the way a scalable value is.
 * An exact fraction stays exact. Absent when the recipe authored none.
 */
function scalingAttrs(meta: RecipeMeta): Record<string, string> {
    const attrs: Record<string, string> = {
        [DATA_KEYS.scalingType]: meta.scalingType,
        [DATA_KEYS.unitSystem]: meta.unitSystem,
    };

    if (meta.base !== undefined) {
        attrs[DATA_KEYS.base] = JSON.stringify(meta.base);
    }

    return attrs;
}

/**
 * The flexbox DOM bindings: where it sits, and which way it lays its own
 * children out.
 *
 * `side` is what the box is to its parent; `flow` is what it is to its
 * children.
 *
 * `edge` is which of the box's own edges are its container's rather than
 * a line between it and a neighbour. It is a styling marker.
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
 * The unit identity is bound to the ingredient.
 */
function ingredientNode(
    box: Box,
    node: Ingredient,
    draw?: Quantity,
): StructureNode {
    const dataAttrs: Record<string, string> = structureAttrs(box);

    if (node.quantity !== null && node.quantity.unitOfMeasureID !== null) {
        dataAttrs[DATA_KEYS.uomID] = node.quantity.unitOfMeasureID;
    }

    return partNode('ingredient', {
        dataAttrs,
        children: contentChildren(
            node.description,
            node.quantity ?? undefined,
            'ingredient-description',
            draw,
        ),
    });
}

/**
 * A cross-file link's line: the amount the author wrote, when they wrote one,
 * then the link itself.
 */
function recipeReferenceChildren(
    link: StructureNode,
    amount?: Amount,
): StructureNode[] {
    const into = bag();

    if (amount !== undefined) {
        if (amount.kind === 'quantity') {
            quantityInto(into, amount);
            into.text(' ');
        }
        else {
            into.text(`${amount.wording}${amount.preposition} `);
        }
    }

    into.node(link);

    return into.done();
}

/**
 * A cross-file link: an `<a>` carrying the link text, in a content `<p>`.
 */
function recipeReferenceNode(box: Box, node: RecipeReference): StructureNode {
    const link: StructureNode = {
        tag: 'a',
        dataAttrs: { [DATA_KEYS.targetSlug]: node.targetSlug },
        text: node.name,
        children: [],
    };

    if (node.title !== undefined) {
        link.attrs = { title: node.title };
    }

    const dataAttrs: Record<string, string> = structureAttrs(box);
    const amount = node.amount;

    if (amount !== undefined && amount.kind === 'quantity'
        && amount.unitOfMeasureID !== null) {
        dataAttrs[DATA_KEYS.uomID] = amount.unitOfMeasureID;
    }

    return partNode('recipe-reference', {
        dataAttrs,
        children: [
            {
                tag: 'p',
                dataAttrs: {},
                children: recipeReferenceChildren(link, amount),
            },
        ],
    });
}

/**
 * A step's action leaf: the action text the step is named by, in a content
 * `<p>`.
 *
 * The step's row box and this leaf carry the same {@link Step}; `side` is what
 * tells them apart.
 */
function actionNode(box: Box, node: Step): StructureNode {
    return partNode('action', {
        dataAttrs: structureAttrs(box),
        children: contentChildren(node.description),
    });
}

/**
 * sub-recipe header node.
 */
function subRecipeHeaderNode(box: Box, node: SubRecipe): StructureNode {
    return partNode('sub-recipe-header', {
        dataAttrs: structureAttrs(box),
        ...({ text: node.heading }),
    });
}

/**
 * A reference's node, and its children.
 *
 * The amount is a {@link Quantity} when the line restated a measure,
 * a {@link Remainder} when it asked for the rest, and absent when the
 * line named the output with no amount at all.
 *
 * The amount rides the edge because a shared node is reached from more than one
 * place and each use draws its own. A {@link Quantity} draw is not emitted here:
 * it is what the target is drawn *of*, so it is handed down and leads the
 * target's own line, where the two amounts read together. A {@link Remainder}
 * is drawn here, because it replaces that line rather than leading it, and a
 * declared amount standing at a use site that named none would be read as the
 * amount to use.
 */
function referenceNode(
    box: Box,
    node: Reference,
    children: StructureNode[],
): StructureNode {
    const amount = node.amount;

    if (amount !== undefined && amount.kind === 'remainder') {
        return partNode('reference', {
            dataAttrs: structureAttrs(box),
            children: [
                remainderNode(
                    amount,
                    (node.resolvedNode as Ingredient).description,
                ),
            ],
        });
    }

    return partNode('reference', {
        dataAttrs: structureAttrs(box),
        children,
    });
}

/**
 * Remainder node. For example, `Remaining distilled water` names the amount
 * and the ingredient together, so the target is named here is the authored
 * wording and preposition.
 */
function remainderNode(
    amount: Remainder,
    description: ScaledValueString,
): StructureNode {
    const into = bag();

    into.text(`${amount.wording}${amount.preposition} `);
    inlineInto(into, description, 'ingredient-description');

    return partNode('remainder', {
        children: [{ tag: 'p', dataAttrs: {}, children: into.done() }],
    });
}

/**
 * The structure node for one box, and everything under it.
 */
function nodeForBox(
    shape: CardShape,
    meta: RecipeMeta,
    id: BoxId,
    draw?: Quantity,
): StructureNode {
    const box = shape.boxes[id];
    const children = (): StructureNode[] =>
        box.children.map((child) => nodeForBox(shape, meta, child, draw));

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
            return ingredientNode(box, box.node, draw);
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
        case 'reference': {
            // Pass the amount so it reaches the target node.
            const amount = box.node.amount;

            return referenceNode(
                box,
                box.node,
                box.children.map((child) =>
                    nodeForBox(
                        shape,
                        meta,
                        child,
                        amount?.kind === 'quantity' ? amount : undefined,
                    ),
                ),
            );
        }
    }
}

/**
 * The recipe's render structure: the root container holding the card.
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
