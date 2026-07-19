/**
 * Build an element tree from a walked recipe structure.
 *
 * The second structure pass. Each {@link StructureNode} from `walk.ts` becomes
 * an {@link ElementNode}: a plain, serialisable element description, no DOM and
 * no framework. The raw output stands on its own: a `<div>` tree, walkable by a
 * screen reader, that reads as a recipe with no styling applied.
 *
 * Element choice follows what a part IS, not how it lays out:
 *   - structural parts (root, grid, sub-recipe, step, ingredient, reference) are
 *     `<div>`: neutral containers that impose no document role on the consumer.
 *   - a title is an `<h1>`, a sub-recipe header an `<h2>`.
 *   - text a node carries is a `<p>`; a quantity is a `<span>` within it, so the
 *     amount can be styled or handled on its own.
 *   - a scalable number is a marked node inside the text, carrying its base value
 *     so a runtime scaler can rescale it. This pass never scales; the runtime
 *     `scale(node, factor)` is a renderer/binding concern.
 *
 * The `data-recipe-grid-*` part marker, the grid extents, and base values ride
 * through as attributes for a later CSS pass and the runtime binding.
 */

import type { Quantity, ScaledValueString } from '../model.ts';
import { DATA_KEYS, part, tagForPart } from './parts.ts';
import type { Content, StructureNode } from './walk.ts';

/**
 * A plain, serialisable element description.
 */
export interface ElementNode {
    // The HTML tag name, e.g. 'div', 'p', 'h1', 'span'.
    tag: string;
    // Attributes, keyed by attribute name (part marker, data-*).
    attrs: Record<string, string>;
    // Literal text content, when this element is a leaf of text.
    text?: string;
    // Child elements.
    children: ElementNode[];
}

/**
 * The attributes carried by an element: its part marker, the core's data-*
 * bindings, and any semantic HTML attributes the node sets (e.g. an <a>'s title).
 */
function markerAttrs(node: StructureNode): Record<string, string> {
    return { [node.part]: '', ...node.dataAttrs, ...node.attrs };
}

/**
 * True when a ScaledValueString part is a scalable number (vs literal text).
 */
function isNumberPart(p: ScaledValueString[number]): p is Exclude<ScaledValueString[number], string> {
    return typeof p !== 'string';
}

/**
 * The inline children of a scale-aware string: literal text stays as text nodes,
 * each scalable number becomes a marked `scaled-value` span carrying its base
 * value. The runtime scaler targets these spans; this pass leaves them unscaled.
 */
function inlineContent(text: ScaledValueString): ElementNode[] {
    return text.map((piece): ElementNode =>
        isNumberPart(piece)
            ? {
                  tag: 'span',
                  attrs: {
                      [part('scaled-value')]: '',
                      [DATA_KEYS.value]: JSON.stringify(piece),
                  },
                  text: String(piece),
                  children: [],
              }
            : { tag: 'span', attrs: {}, text: piece, children: [] },
    );
}

/**
 * A quantity as a `<span>`: its value (scalable) plus unit/preposition text.
 */
function quantityElement(quantity: Quantity): ElementNode {
    const valueSpan: ElementNode = {
        tag: 'span',
        attrs: {
            [part('scaled-value')]: '',
            [DATA_KEYS.value]: JSON.stringify(quantity.value),
        },
        text: String(quantity.value),
        children: [],
    };
    const unitText =
        quantity.unit !== null ? `${quantity.valueUnitSpacing}${quantity.unit}` : '';
    const trailing = `${unitText}${quantity.preposition}`;
    const children: ElementNode[] = [valueSpan];
    if (trailing !== '') {
        children.push({ tag: 'span', attrs: {}, text: trailing, children: [] });
    }
    return { tag: 'span', attrs: { [part('quantity')]: '' }, children };
}

/** The element(s) rendering a node's carried text and quantity, if any. */
function contentChildren(content: Content): ElementNode[] {
    const out: ElementNode[] = [];
    if (content.quantity !== undefined) {
        out.push(quantityElement(content.quantity));
    }
    if (content.text !== undefined) {
        out.push(...inlineContent(content.text));
    }
    return out;
}

/** Build the element tree for one walked structure node. */
export function build(node: StructureNode): ElementNode {
    const tag = tagForPart(node.part);
    const attrs = markerAttrs(node);

    // A heading carries its text directly on the heading element.
    if (tag === 'h1' || tag === 'h2') {
        const text = node.content?.text;
        return {
            tag,
            attrs,
            children: text !== undefined ? inlineContent(text) : [],
        };
    }

    /*
     * A recipe-reference is a bare <a>: its only content is the link text. Its
     * target-slug binding and its `title` HTML attribute are already on `attrs`
     * (via markerAttrs). The text sits directly on the anchor (no wrapping <p> or
     * <span>), so the consumer gets a plain, trivially styleable link. Link text
     * is literal (no scalable numbers), so the ScaledValueString flattens to a
     * single string.
     */
    if (node.part === part('recipe-reference')) {
        const text = node.content?.text;
        return {
            tag,
            attrs,
            text: text !== undefined ? text.map(String).join('') : '',
            children: [],
        };
    }

    /*
     * A step is the bracket: its inputs form a column on the left, its action
     * (label) sits to the right. Emit inputs-then-label so DOM order matches
     * reading order (inputs -> action), which the flex layout and a later ARIA
     * pass both rely on.
     */
    if (node.part === part('step')) {
        const stepChildren: ElementNode[] = [
            { tag: 'div', attrs: { [part('inputs')]: '' }, children: node.children.map(build) },
        ];
        if (node.content !== undefined) {
            const labelEls = contentChildren(node.content);
            if (labelEls.length > 0) {
                stepChildren.push({ tag: 'p', attrs: {}, children: labelEls });
            }
        }
        return { tag, attrs, children: stepChildren };
    }

    const children: ElementNode[] = [];

    // Text a structural node carries renders as a `<p>` of that content.
    if (node.content !== undefined) {
        const contentEls = contentChildren(node.content);
        if (contentEls.length > 0) {
            children.push({ tag: 'p', attrs: {}, children: contentEls });
        }
    }

    // Then the node's own children.
    children.push(...node.children.map(build));

    return { tag, attrs, children };
}
