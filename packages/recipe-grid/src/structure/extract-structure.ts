/**
 * Extract the full structure from the compiled DAG.
 *
 * `extract-shape.ts` provides the nesting and sides. This extract pass walks
 * the finished box tree and gives each box what it renders as: a tag, a part
 * marker, the machine-readable `data-*` bindings, the semantic HTML attributes
 * the node sets, and the literal text of a leaf.
 *
 * This provides the complete element tree. Every element the DOM needs is a
 * real {@link StructureNode}. A downstream renderer * turns this into elements
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
 *
 * A run of text takes its place in line as it arrives, as its own child. What
 * led a piece is handed in before that piece and stands there -- between what
 * came before and the piece it leads -- rather than inside either of them. A
 * consumer replacing a piece's text touches only what it named; the spacing
 * beside it belongs to the paragraph and is untouched.
 *
 * An empty run is nothing to place, so it adds no child.
 *
 * This is why the pass cannot emit as it walks: a run has no element of its
 * own, so it has nowhere to go until the element holding it is assembled. What
 * comes out is the element's children -- text and spans interleaved, reading as
 * the line was written.
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
 *
 * Each piece is preceded by what led it -- text, placed before the piece rather
 * than inside it, since the model holds the two apart and putting them together
 * would bury the spacing inside whatever the piece is.
 *
 * A piece the vocabulary claimed is a `uom-name` span; a piece it did not is
 * text, since whether a piece is a unit name is the only thing this pass knows
 * about it. The canonical key rides on the ingredient, where a consumer reading
 * the ingredient finds it.
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
 * A scale-aware string, into the bag its paragraph is gathering: each scalable
 * number a `scaled-value` span, each literal run a marked span when the caller
 * names it and text when nothing does.
 *
 * A scalable number and the run after it meet at a seam the model does not
 * hold: braces are how an author names a unit the vocabulary has no word for,
 * and the grammar drops the space between the value and that name the way it
 * drops the one in `4 cloves`. It is a single space every time, and it is
 * placed here, where the two meet. A number ending the string has nothing
 * after it and gets none.
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
 *
 * The paragraph is where the pieces meet: a quantity's value, unit and
 * prepositions and a description are all runs of one line, so they are
 * siblings in one `<p>` rather than each sealed in a wrapper of its own.
 *
 * A quantity and a description meet at a seam the model does not hold: the
 * grammar reaches the description only after the quantity, so the run between
 * them is a space every time and there is nothing else it could be. It is
 * placed here, where the two meet, rather than stored on every node. A line
 * with no quantity has no seam, and nothing is placed.
 *
 * A `draw` is the amount a use site asked for, handed down from the reference
 * that made it. It leads the line, and ` / ` stands between it and the amount
 * the node was declared with, so a partial use reads as what it is: this much,
 * of that. Both amounts render and neither replaces the other -- what is left
 * after earlier draws is arithmetic this pass does not do, and a validator's
 * question.
 *
 * That separator is nomenclature rather than recovery: unlike the seam above,
 * the author never wrote it. It is a bare run and not a word, so no locale is
 * baked into the card -- a theme reads the two `scaled-value` spans it stands
 * between and decorates them however its readers expect.
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
 * {@link RecipeNumber} and is serialised whole, the way a scalable value is --
 * an exact fraction stays exact. Absent when the recipe authored none.
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
 * The unit identity rides on the ingredient: it is what the measure converts
 * with, and the `uom-name` span carries only the name the author wrote. The
 * base value does not -- it is on the `scaled-value` span, which is the element
 * a scaler rewrites, so a second copy here would be a value nothing reads and
 * nothing keeps in step.
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
 *
 * The link is an element rather than a run, so it stands in the paragraph
 * beside the value the way a unit name does. The run between them is a space
 * every time, and it is placed here, where the two meet.
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
 *
 * `targetSlug` rides through as a data binding for the consumer to resolve into
 * whatever link they need -- an in-page jump, a route, an external URL, or
 * nothing at all. The core does not know which, so it emits no href. `title`,
 * when the author wrote one, is a real HTML attribute.
 *
 * The paragraph is where the pieces meet, the way an ingredient's do: an
 * authored amount is a `scaled-value` span standing beside the link rather than
 * inside it, since the number is not part of the link's text. A reference the
 * author gave no amount holds the link alone.
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
 * A sub-recipe's header.
 */
function subRecipeHeaderNode(box: Box, node: SubRecipe): StructureNode {
    return partNode('sub-recipe-header', {
        dataAttrs: structureAttrs(box),
        ...({ text: node.heading }),
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
 * place and each use draws its own. A {@link Quantity} draw is not emitted here:
 * it is what the target is drawn *of*, so it is handed down and leads the
 * target's own line, where the two amounts read together. A {@link Remainder}
 * is drawn here, because it replaces that line rather than leading it -- a
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
 * A "use the rest" note: the remainder wording and the name it drew from, as
 * the one line the author wrote, in a content `<p>`.
 *
 * `Remaining distilled water` names the amount and the thing together, so the
 * target is named here rather than transcluded beneath. Transcluding it would
 * draw the ingredient's own quantity at a use site that stated none, and no
 * value can be right there: the ingredient list is the definitive amount, and
 * what is left after earlier draws would need arithmetic this pass does not do.
 * That is a validation question, and the reference still carries the edge for
 * one to ask it.
 *
 * The wording and its preposition are the note's own text, so they sit in the
 * paragraph the way a step's action text does -- literal, unmarked, and run
 * together as authored, leading space and all. The name after them keeps the
 * span that marks it, since that is the ingredient a consumer reaches. The run
 * between the two is a space every time, the same seam
 * {@link contentChildren} places between a quantity and the description after
 * it, and it is placed here where they meet.
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
 *
 * Dispatch is on the box, not the model: `side` first, because a step's row box
 * and its action leaf carry the same node, as do a sub-recipe's region box and
 * its header. Children are always the box's children -- the model is never
 * recursed into, because the shape pass already did that.
 *
 * `draw` is a quantity a reference above asked for, riding down to the node it
 * draws from. An ingredient is sometimes bare beneath its reference and
 * sometimes reached through what stands between, so the draw travels with the
 * descent and lands where the amount belongs.
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
            /*
             * The reference's box wraps the target it transcludes. A quantity
             * draw goes down with the descent rather than standing beside the
             * target, so it reaches the node it is an amount of. A remainder
             * does not descend: referenceNode draws it in the target's place.
             */
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
