import { describe, it, expect } from 'vitest';
import { Recipe } from './index';

/**
 * Smoke test: the package's public surface is intact. Not the parser (that
 * lives in @wendall911/recipe-grid) and not component DOM rendering (that comes
 * later via the standalone Svelte 5 DOM tests). Just: the exports resolve and
 * the namespaced parts are present.
 */
describe('recipe-grid-svelte package (smoke)', () => {
  it('exports the Recipe namespace with all parts', () => {
    expect(Recipe).toBeDefined();
    expect(Recipe.Root).toBeDefined();
    expect(Recipe.Grid).toBeDefined();
    expect(Recipe.Title).toBeDefined();
    expect(Recipe.Servings).toBeDefined();
  });
});
