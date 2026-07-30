/*
 * Node guards for reading a compiled DAG in tests.
 *
 * Types are erased, so a cast asserts a shape rather than checking one. These
 * narrow off the runtime `kind` discriminant, which means an assertion over one
 * fails when the shape changes instead of reading undefined off a cast.
 */

import type { Reference, RecipeTreeNode, Step } from '../../src/model.ts';

export function isStep(node: RecipeTreeNode): node is Step {
    return node.kind === 'step';
}

export function isReference(node: RecipeTreeNode): node is Reference {
    return node.kind === 'reference';
}
