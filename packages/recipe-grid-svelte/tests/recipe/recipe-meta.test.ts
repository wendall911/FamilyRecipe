import { describe, it, expect } from 'vitest';
import { RecipeContext } from '../../src/recipe.js';
import { loadFixture } from '../util/loadFixture.js';

const md = loadFixture('turkish-pizza.md');

describe('Recipe metadata', () => {
    it('carries the frontmatter meta bag', () => {
        const { meta } = new RecipeContext(md).parsed;

        expect(meta.scalingType).toBe('servings');
        expect(meta.base).toBe(4);
        expect(meta.unitSystem).toBe('us');
        expect(meta.slug).toBe('turkish-pizza');
    });

    it('does not yet carry arbitrary custom keys in the meta bag', () => {
        const { meta } = new RecipeContext(md).parsed;

        /*
         * `source` is set in the fixture frontmatter, but recipe-grid does not
         * pass unknown keys through yet. Pinning undefined as a tripwire: when
         * the pass-through lands, this fails as the signal to update the test
         * and document custom metadata.
         */
        expect((meta as Record<string, unknown>).source).toBeUndefined();
    });
});
