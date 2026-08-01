/**
 * Extract the card's shape from a compiled recipe DAG.
 *
 * This pass answers *what nests inside what, and on which side*. It emits no
 * tags, no `data-*` bindings, no part markers, no text: only the box tree the
 * card is built from. The second pass consumes this and fills in content.
 *
 * The split exists because a single bottom-up recursion cannot express
 * card-level facts. A node visited on the way up knows its own subtree and
 * nothing else -- not which column it shares with its siblings, not what sits to
 * its right, not where a region begins. Those are facts about the whole card,
 * so they need a stage where the whole card is in hand.
 *
 * 
 * The card is flexbox, not a table. A table needs every cell's row, column and
 * span computed up front, because the grid is a fixed lattice and every cell
 * must be placed in it. Flexbox needs none of that: a box is as wide as its
 * contents and the space its parent gives it, and the browser resolves the rest.
 *
 * So this pass does no arithmetic. A step is a row holding its inputs on the
 * left and its own action on the right; the inputs are a column of boxes. That
 * nesting *is* the layout. Asking "how many columns does this span" is a table
 * question, and answering it here would bake a lattice into a structure that
 * does not have one.
 *
 * Extent (rows and columns a subtree would occupy if it were a table) is still
 * computed, but only as a description of the card for reading a dump by eye. It
 * is not part of the layout and no box carries it.
 *
 * Three steps, only two of which walk the DAG:
 *
 *   1. COLLECT  - which trees are card roots (the rest are transcluded at their
 *                 use site). A small traversal.
 *   2. BUILD    - top-down, one box per node plus the grouping boxes the layout
 *                 needs. The substantive traversal.
 *   3. RELATE   - what each box touches, by walking the finished tree. Not a
 *                 traversal of the DAG: the boxes are already built, so this is
 *                 sibling and parent order.
 *
 * Nothing here transforms or validates. Whatever the DAG holds is what gets
 * built.
 */

import type {
    Recipe,
    RecipeReference,
    RecipeTreeNode,
    SubRecipe,
} from '../model.ts';

import { svsToString } from '../recipe-model.ts';

/*
 * Shape types
 */

// A box's handle within one CardShape. Stable only within that shape.
export type BoxId = number;

// A region's handle within one CardShape. Stable only within that shape.
export type RegionId = number;

/**
 * How a box arranges its children.
 *
 * - `row`    left to right: a step's inputs, then its action.
 * - `column` top to bottom: the inputs feeding one step, or a region's header
 *            above its body.
 * - `leaf`   no children; the box is the content.
 */
export type Flow = 'row' | 'column' | 'leaf';

/**
 * What a box is to its parent. This is the whole of "where it sits" -- there are
 * no coordinates, because the nesting already places it.
 *
 * - `inputs` the column of things feeding a step, on the step's left.
 * - `action` the step itself, to the right of what feeds it.
 * - `header` a sub-recipe's title band, across the top of its region.
 * - `body`   everything under that band.
 * - `root`   a top-level tree of the card.
 */
export type Side = 'inputs' | 'action' | 'header' | 'body' | 'root';

/**
 * One box in the card.
 *
 * A box either carries a model node (an ingredient, a step's action, a link) or
 * is a grouping box the layout needs and the model has no node for (the inputs
 * column, a region's body). `node` is carried by reference, not copied -- the
 * second pass reads content straight off it. This pass does not look at
 * content at all.
 */
export interface Box {
    id: BoxId;
    // The model node this box renders, or null for a pure grouping box.
    node: RecipeTreeNode | null;
    flow: Flow;
    // What this box is to its parent; `root` at the top of a tree.
    side: Side;
    parent: BoxId | null;
    children: BoxId[];
    /**
     * The sub-recipe regions containing this box, outermost first. Empty when
     * the box sits outside every region.
     */
    within: RegionId[];
    /**
     * What this box touches. Filled by step 3; every box has an entry before
     * that step runs.
     */
    touches: Touches;
}

/**
 * What lies against a box's edges -- the adjacency a border rule needs, so a
 * consumer is not left deriving it from the DOM.
 *
 * `null` means nothing is there: the box's edge is its container's edge. In a
 * nested layout that is what makes a border the outer boundary of a group
 * rather than a line between two things.
 */
export interface Touches {
    before: BoxId | null;
    after: BoxId | null;
}

/**
 * A sub-recipe's bounded area: a header band across the top, and the body
 * beneath it.
 *
 * The band is what breaks the ingredient column. Ingredients above and below a
 * region sit in the same column of the card, but the band runs across between
 * them, so the column's run is interrupted rather than continuous.
 */
export interface Region {
    id: RegionId;
    subRecipe: SubRecipe;
    /** The box holding the whole region: header and body together. */
    box: BoxId;
    /** The header band. */
    header: BoxId;
    /** Everything below the header. */
    body: BoxId;
    /** The regions containing this one, outermost first; empty at top level. */
    within: RegionId[];
}

/**
 * How much of a table this subtree would occupy. Not layout -- the card does not
 * have a lattice -- but a useful description when reading a dump: it says how
 * tall and how deep the card is, which a box tree alone does not show at a
 * glance.
 */
export interface Extent {
    rows: number;
    columns: number;
}

/**
 * The whole card's shape: a tree of boxes, the regions bounding parts of it,
 * and the card's overall extent for reading.
 */
export interface CardShape {
    //The card's outermost box.
    root: BoxId;
    boxes: Box[];
    regions: Region[];
    extent: Extent;
}

// Step 1 - COLLECT: which trees are card roots

/**
 * Every node referenced from within a subtree. A referenced target is laid out
 * inline where it is referenced, so it is not also a root of the card.
 *
 * A target may be a SubRecipe (`:=`) or an `=`-labelled Ingredient/Step, so any
 * referenced node counts, not only SubRecipe ones.
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
 * The cross-file links declared in the ingredient column, keyed by the name
 * later lines use to reach them.
 *
 * A `RecipeReference` is an ingredient that happens to be a link — declared in
 * the ingredient list like any other, and drawn on at a use site further into
 * the card. Unlike an `=`-labelled ingredient it has no `reference` edge
 * pointing at it: the use site is a plain `ingredient` node carrying the same
 * text, because a bare markdown link is self-naming and the compiler has no
 * label to bind. Matching is by name, the way the author wrote it.
 */
function linksByName(trees: RecipeTreeNode[]): Map<string, RecipeReference> {
    const links = new Map<string, RecipeReference>();

    for (const tree of trees) {
        if (tree.kind === 'recipeReference') {
            links.set(tree.name.trim().toLowerCase(), tree);
        }
    }

    return links;
}

/**
 * The node a use site resolves to: the declared link when its text names one,
 * otherwise the node itself.
 *
 * This is what stops a linked ingredient being drawn twice — once as a stray
 * root at the top of the card and once as a plain text box where it is used.
 * There is one ingredient; the link is it.
 */
function resolveLink(
    node: RecipeTreeNode,
    links: Map<string, RecipeReference>,
): RecipeTreeNode {
    if (node.kind !== 'ingredient' || node.quantity !== null) {
        return node;
    }

    const named = links.get(svsToString(node.description).trim().toLowerCase());

    return named ?? node;
}

/**
 * Mark every declared link some use site inside a subtree names. Mirrors
 * {@link collectReferenced}, for the links that carry no edge of their own.
 */
function collectLinked(
    node: RecipeTreeNode,
    links: Map<string, RecipeReference>,
    into: Set<RecipeTreeNode>,
): void {
    switch (node.kind) {
        case 'ingredient': {
            const resolved = resolveLink(node, links);
            if (resolved !== node) into.add(resolved);
            return;
        }
        case 'step':
            node.inputs.forEach((input) => collectLinked(input, links, into));
            return;
        case 'subRecipe':
            collectLinked(node.subTree, links, into);
            return;
        case 'reference':
            collectLinked(node.resolvedNode, links, into);
            return;
        case 'recipeReference':
            return;
    }
}

/**
 * The trees no other tree draws on: the independent roots of the card.
 *
 * A tree is not a root when something else uses it -- through a `reference`
 * edge, or by naming a declared cross-file link. Either way it is laid out at
 * its use site, not repeated at the top of the card.
 */
function cardRoots(recipe: Recipe): RecipeTreeNode[] {
    const referenced = new Set<RecipeTreeNode>();
    recipe.recipeTrees.forEach((tree) => collectReferenced(tree, referenced));

    const links = linksByName(recipe.recipeTrees);
    recipe.recipeTrees.forEach((tree) => collectLinked(tree, links, referenced));

    return recipe.recipeTrees.filter((tree) => !referenced.has(tree));
}

// Extent - a table-shaped description of the card, for reading a dump

/**
 * Rows a subtree would occupy: one per terminal, following a reference into its
 * target, plus one for a sub-recipe's header band.
 */
function rowsOf(node: RecipeTreeNode): number {
    switch (node.kind) {
        case 'ingredient':
        case 'recipeReference':
            return 1;
        case 'reference':
            return rowsOf(node.resolvedNode);
        case 'step':
            return node.inputs.reduce((n, input) => n + rowsOf(input), 0);
        case 'subRecipe':
            return rowsOf(node.subTree) + 1;
    }
}

/**
 * Columns a subtree would occupy: a step is one past its deepest input; a
 * reference occupies its target's depth; a header adds none of its own.
 */
function columnsOf(node: RecipeTreeNode): number {
    switch (node.kind) {
        case 'ingredient':
        case 'recipeReference':
            return 1;
        case 'reference':
            return columnsOf(node.resolvedNode);
        case 'step':
            return 1 + Math.max(...node.inputs.map(columnsOf));
        case 'subRecipe':
            return columnsOf(node.subTree);
    }
}

// Step 2 - BUILD: one box per node, plus the grouping boxes the layout needs

/**
 * Boxes and regions accumulate here as the walk descends.
 */
interface Building {
    boxes: Box[];
    regions: Region[];
    // Declared cross-file links, so a use site can build the link itself.
    links: Map<string, RecipeReference>;
}

/**
 * Record a box, returning its id. Children are attached as they are built.
 */
function addBox(
    state: Building,
    fields: {
        node: RecipeTreeNode | null;
        flow: Flow;
        side: Side;
        parent: BoxId | null;
        within: RegionId[];
    },
): BoxId {
    const id = state.boxes.length;

    state.boxes.push({
        id,
        ...fields,
        children: [],
        // Filled by step 3; every box needs an entry before adjacency runs.
        touches: { before: null, after: null },
    });

    return id;
}

/**
 * Build the box for a node and everything under it, returning its id.
 *
 * `side` is what this box is to its parent. `parent` is null only at the top of
 * a root tree, where the card's own box takes over as container.
 */
function build(
    state: Building,
    node: RecipeTreeNode,
    side: Side,
    parent: BoxId | null,
    within: RegionId[],
): BoxId {
    switch (node.kind) {
        case 'ingredient':
        case 'recipeReference': {
            /*
             * A terminal is a leaf: it holds content and nothing else. An
             * ingredient naming a declared link becomes the link -- the box is
             * the anchor, not a copy of its text.
             */
            return addBox(state, {
                node: resolveLink(node, state.links),
                flow: 'leaf',
                side,
                parent,
                within,
            });
        }

        case 'step': {
            /*
             * A step is a row: what feeds it on the left, the step's own action
             * on the right. The things feeding it are a column -- they stack,
             * and the step sits beside the whole stack rather than beside any
             * one of them.
             *
             * That is the bracket the card draws, and it needs no widths: the
             * inputs column is as wide as its deepest member, the action sits
             * after it, and flex resolves the rest.
             */
            const box = addBox(state, {
                node,
                flow: 'row',
                side,
                parent,
                within,
            });
            const inputs = addBox(state, {
                node: null,
                flow: 'column',
                side: 'inputs',
                parent: box,
                within,
            });

            for (const input of node.inputs) {
                state.boxes[inputs].children.push(
                    build(state, input, 'inputs', inputs, within),
                );
            }

            const action = addBox(state, {
                node,
                flow: 'leaf',
                side: 'action',
                parent: box,
                within,
            });

            state.boxes[box].children.push(inputs, action);

            return box;
        }

        case 'reference': {
            /*
             * A reference transcludes its target: the target's structure is
             * built here, in this position, and what the reader sees is the
             * target.
             *
             * The reference still gets a box of its own, wrapping that. It is
             * where the draw the use site made lives -- a quantity when the line
             * restated a measure, a remainder when it asked for the rest. The
             * amount rides the edge, not the node, because a shared node is
             * reached from more than one place and each use draws its own. A box
             * for the target alone has nowhere to carry it, and the draw would
             * not survive into the DOM.
             */
            const box = addBox(state, {
                node,
                flow: 'column',
                side,
                parent,
                within,
            });

            state.boxes[box].children.push(
                build(state, node.resolvedNode, side, box, within),
            );

            return box;
        }

        case 'subRecipe': {
            /*
             * A sub-recipe is a bounded region: a header band across the top,
             * its body beneath. The region is a column -- the band, then
             * everything under it -- and that column is what a border draws
             * around.
             */
            const box = addBox(state, {
                node,
                flow: 'column',
                side,
                parent,
                within,
            });
            const id = state.regions.length;
            const inner = [...within, id];
            const header = addBox(state, {
                node,
                flow: 'leaf',
                side: 'header',
                parent: box,
                within,
            });
            const body = addBox(state, {
                node: null,
                flow: 'column',
                side: 'body',
                parent: box,
                within: inner,
            });

            state.boxes[body].children.push(
                build(state, node.subTree, 'body', body, inner),
            );

            state.boxes[box].children.push(header, body);

            state.regions.push({
                id,
                subRecipe: node,
                box,
                header,
                body,
                within,
            });

            return box;
        }
    }
}

// Step 3 -- RELATE: what each box touches, from the finished tree

/**
 * Fill in what lies against each box's edges.
 *
 * In a nested layout adjacency is sibling order: the box before you and the box
 * after you, within your parent. A box at either end of its parent's children
 * touches nothing on that side -- its edge is the parent's edge, which is what
 * makes a border there the boundary of the group rather than a line between two
 * members of it.
 *
 * This runs after the tree is built because a box's siblings do not exist while
 * it is being built. That is why it is its own step.
 */
function relate(boxes: Box[]): void {
    for (const box of boxes) {
        box.children.forEach((childId, i) => {
            boxes[childId].touches = {
                before: i > 0 ? box.children[i - 1] : null,
                after: i < box.children.length - 1 ? box.children[i + 1] : null,
            };
        });
    }
}

// Extract shape pass

/**
 * The card's shape: every box built, every adjacency resolved, every sub-recipe
 * region bounded. The input to the second pass.
 */
export function extractShape(recipe: Recipe): CardShape {
    const roots = cardRoots(recipe);
    const state: Building = {
        boxes: [],
        regions: [],
        links: linksByName(recipe.recipeTrees),
    };

    /*
     * The card is a column: its trees stack, each a row of its own. A card with
     * one tree is still a column of one -- the shape does not special-case it.
     */
    const card = addBox(state, {
        node: null,
        flow: 'column',
        side: 'root',
        parent: null,
        within: [],
    });

    for (const root of roots) {
        state.boxes[card].children.push(build(state, root, 'root', card, []));
    }

    relate(state.boxes);

    return {
        root: card,
        boxes: state.boxes,
        regions: state.regions,
        extent: {
            rows: roots.reduce((n, t) => n + rowsOf(t), 0),
            columns: roots.length > 0 ? Math.max(...roots.map(columnsOf)) : 0,
        },
    };
}
