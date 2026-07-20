import { describe, it, expect } from 'vitest';
import { parse, RecipeNode } from '../../src/index.ts';

/*
 * Smoke test: the package's public surface resolves. Not the parser (that lives
 * in @wendall911/recipe-grid) and not component DOM rendering (that comes later
 * via the standalone Svelte 5 DOM tests). Just: the exports are present and the
 * expected shapes.
 */
describe('recipe-grid-svelte package (smoke)', () => {
  it('exports parse as a function and RecipeNode as a component', () => {
    expect(typeof parse).toBe('function');
    expect(RecipeNode).toBeDefined();
  });
});
