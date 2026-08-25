/**
 * Build an element tree from a walked recipe structure.
 *
 * A pure transport over the render structure: each {@link StructureNode} from
 * `extract-structure.ts` becomes an {@link ElementNode}.
 */

import type { StructureNode } from './extract-structure.ts';

/**
 * A plain, serialisable element description.
 *
 */
export interface ElementNode {
    /*
     * The HTML tag name, e.g. 'div', 'p', 'h1', 'span'; absent on a run of
     * text, which has no element around it.
     */
    tag?: string;
    // Attributes, keyed by attribute name (part marker, data-*).
    attrs: Record<string, string>;
    // Literal text content, when this element is a leaf of text.
    text?: string;
    // Child elements.
    children: ElementNode[];
}

/**
 * The attributes carried by an element: its part marker (when the node is a
 * part), the core's data-* bindings, and any semantic HTML attributes the node
 * sets (e.g. an <a>'s title). A plain element node (a `<p>`) has no marker, and
 * neither does a run of text.
 */
function markerAttrs(node: StructureNode): Record<string, string> {
    return {
        ...(node.part !== undefined ? { [node.part]: '' } : {}),
        ...node.dataAttrs,
        ...node.attrs,
    };
}

/**
 * Build the element for one structure node: its tag, its attributes, its leaf
 * text, and its built children. A pure copy — the structure already describes
 * the full element tree.
 */
export function build(node: StructureNode): ElementNode {
    const element: ElementNode = {
        attrs: markerAttrs(node),
        children: node.children.map(build),
    };

    if (node.tag !== undefined) {
        element.tag = node.tag;
    }

    if (node.text !== undefined) {
        element.text = node.text;
    }

    return element;
}
