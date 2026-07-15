/**
 * Walk a compiled recipe DAG and map each node to its render part.
 *
 * The framework-neutral structure pass. Each {@link RecipeTreeNode} becomes a
 * {@link StructureNode} carrying its part marker, machine-readable `data-*`
 * attributes, its grid extent, and its children. It emits data only — no DOM,
 * no CSS — for a downstream builder to turn into elements.
 *
 * The grid extent is the space a node's subtree occupies when laid out like the
 * recipe table:
 *
 *   - rows    — one per terminal (ingredient / reference). Steps do not add
 *               rows; a headed sub-recipe adds one row for its header.
 *   - columns — a step is a column to the right of the widest of its inputs;
 *               terminals are one column. Sub-recipe headers do not add columns.
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
  RecipeTreeNode,
  Reference,
  ScaledValueString,
  Step,
  SubRecipe,
} from '../model.ts';

import { DATA_KEYS, part, type RecipeGridPart } from './parts.ts';

/** The space a node's subtree occupies in the recipe grid. */
export interface Extent {
  /** Table rows spanned: one per terminal, plus one for a sub-recipe header. */
  rows: number;
  /** Table columns spanned: step depth plus the terminal column. */
  columns: number;
}

/**
 * The text a node carries. A description or output name is a scale-aware string
 * (literal text interleaved with scalable numbers); a quantity is its own shape.
 * Absent on nodes that carry no text of their own (a reference is a pointer).
 */
export interface Content {
  /** A scale-aware string: an ingredient/step description, or an output name. */
  text?: ScaledValueString;
  /** A quantity carried alongside the text (an ingredient's or reference's amount). */
  quantity?: Quantity;
}

/**
 * A node's render structure: its part marker, its `data-*` attribute bag, the
 * text it carries, the grid space it occupies, and its children (already mapped).
 */
export interface StructureNode {
  /** The part marker attribute name, e.g. `data-recipe-grid-step`. */
  part: `data-recipe-grid-${RecipeGridPart}`;
  /** Machine-readable attributes, keyed by attribute name. */
  dataAttrs: Record<string, string>;
  /** The text this node carries, or undefined for a pure-structure node. */
  content?: Content;
  /** The grid space this node's subtree occupies. */
  extent: Extent;
  /** The mapped children of this node. */
  children: StructureNode[];
}

/** True when a node is a terminal — an ingredient or a reference. */
function isTerminal(node: RecipeTreeNode): boolean {
  return node.kind === 'ingredient' || node.kind === 'reference';
}

/**
 * The rows a node's subtree occupies: one per terminal, following a reference
 * into its target, plus one for a headed sub-recipe.
 */
export function extentRows(node: RecipeTreeNode): number {
  switch (node.kind) {
    case 'ingredient':
      return 1;
    case 'reference':
      return extentRows(node.subRecipe);
    case 'step':
      return node.inputs.reduce((n, input) => n + extentRows(input), 0);
    case 'subRecipe':
      return extentRows(node.subTree) + (node.hasHeading ? 1 : 0);
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
      return extentColumns(node.subRecipe);
    case 'step':
      return 1 + Math.max(...node.inputs.map(extentColumns));
    case 'subRecipe':
      return extentColumns(node.subTree);
    case 'recipeReference':
      return 1;
  }
}

/** The grid extent of a node's subtree. */
export function extentOf(node: RecipeTreeNode): Extent {
  return { rows: extentRows(node), columns: extentColumns(node) };
}

/** Serialise a RecipeNumber for a `data-*` value, preserving exact fractions. */
function serializeValue(value: RecipeNumber): string {
  return JSON.stringify(value);
}

/** The `data-*` attributes carried by a quantity's value. */
function quantityDataAttrs(quantity: Quantity): Record<string, string> {
  return { [DATA_KEYS.value]: serializeValue(quantity.value) };
}

/** The scalable numbers embedded in a scale-aware string, in order. */
function scaledValuesOf(svs: ScaledValueString): RecipeNumber[] {
  return svs.filter((p): p is RecipeNumber => typeof p !== 'string');
}

function walkIngredient(node: Ingredient): StructureNode {
  const dataAttrs: Record<string, string> = {};
  const content: Content = { text: node.description };
  if (node.quantity !== null) {
    Object.assign(dataAttrs, quantityDataAttrs(node.quantity));
    content.quantity = node.quantity;
  }
  return {
    part: part('ingredient'),
    dataAttrs,
    content,
    extent: extentOf(node),
    children: [],
  };
}

function walkStep(node: Step): StructureNode {
  return {
    part: part('step'),
    dataAttrs: {},
    content: { text: node.description },
    extent: extentOf(node),
    children: node.inputs.map(walk),
  };
}

function walkReference(node: Reference): StructureNode {
  const dataAttrs: Record<string, string> = {};
  const content: Content = {};
  if (node.amount !== undefined && node.amount.kind === 'quantity') {
    Object.assign(dataAttrs, quantityDataAttrs(node.amount));
    content.quantity = node.amount;
  }
  return {
    part: part('reference'),
    dataAttrs,
    content,
    extent: extentOf(node),
    children: [],
  };
}

function walkSubRecipe(node: SubRecipe): StructureNode {
  const children = [walk(node.subTree)];
  if (node.hasHeading) {
    children.unshift({
      part: part('sub-recipe-header'),
      dataAttrs: {},
      content: { text: node.outputNames[0] },
      extent: { rows: 1, columns: extentColumns(node.subTree) },
      children: [],
    });
  }
  return {
    part: part('sub-recipe'),
    dataAttrs: {},
    extent: extentOf(node),
    children,
  };
}

/** Map a single recipe tree node to its render structure. */
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
      return {
        part: part('reference'),
        dataAttrs: {},
        extent: extentOf(node),
        children: [],
      };
  }
}

/**
 * Collect every sub-recipe referenced by a node's subtree. A referenced
 * sub-recipe is laid out inline where it is referenced, so its rows are already
 * counted inside the referencing tree and must not be counted again at the root.
 */
function collectReferenced(node: RecipeTreeNode, into: Set<SubRecipe>): void {
  switch (node.kind) {
    case 'reference':
      into.add(node.subRecipe);
      collectReferenced(node.subRecipe, into);
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
  // Trees referenced by another tree are transcluded where referenced; only the
  // trees no other tree references are independent roots of the layout.
  const referenced = new Set<SubRecipe>();
  recipe.recipeTrees.forEach((t) => collectReferenced(t, referenced));
  const roots = recipe.recipeTrees.filter(
    (t) => !(t.kind === 'subRecipe' && referenced.has(t)),
  );

  const grid: StructureNode = {
    part: part('grid'),
    dataAttrs: {},
    extent: {
      rows: roots.reduce((n, t) => n + extentRows(t), 0),
      columns: Math.max(...roots.map(extentColumns)),
    },
    children: recipe.recipeTrees.map(walk),
  };

  const dataAttrs: Record<string, string> = {
    [DATA_KEYS.scalingType]: recipe.scalingType,
  };
  if (recipe.base !== undefined) {
    dataAttrs[DATA_KEYS.base] = serializeValue(recipe.base);
  }

  return {
    part: part('root'),
    dataAttrs,
    extent: grid.extent,
    children: [grid],
  };
}
