import { describe, it, expect } from 'vitest';
import { parse } from '@wendall911/recipe-grid';
import { Recipe } from '../../src/index.js';

/*
 * Smoke test: the package's public surface resolves. The parser lives in
 * @wendall911/recipe-grid (imported directly here); the binding publishes the
 * namespaced Recipe.* components. Component DOM rendering is exercised
 * separately. Just: the exports are present and the expected shapes.
 * (Recipe.Root is omitted until it's wired up.)
 */
describe('recipe-grid-svelte package (smoke)', () => {
  it('exports parse from the core and the Recipe.* components', () => {
    expect(typeof parse).toBe('function');
    expect(Recipe.Root).toBeDefined();
    expect(Recipe.Grid).toBeDefined();
    expect(Recipe.Title).toBeDefined();
    expect(Recipe.Description).toBeDefined();
  });
});
