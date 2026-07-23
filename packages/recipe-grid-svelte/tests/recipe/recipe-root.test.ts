import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import { Recipe } from '../../src/index.js';
import { loadFixture } from '../util/loadFixture.js';
import RootHarness from './RootHarness.svelte';

const md = loadFixture('turkish-pizza.md');

describe('Recipe.Root', () => {
    it('emits only the compiler anchor when `as` is nullish', () => {
        /*
         * Empty Root, no `as`: the else branch renders children only. The exact
         * `<!---->` is the Svelte 5 compiler's output for that render. Assert
         * the exact string, not emptiness: a bare "" would mean the render path
         * never ran, and a loose check would pass on that bug.
         */
        const { container } = render(Recipe.Root, { md });

        expect(container.innerHTML).toBe('<!----><!---->');
    });

    it('wraps children in `as` and honors its passthrough contract', () => {
        /*
         * Root's passthrough contract, which is our logic, not Svelte's spread:
         * a consumer prop forwards onto the `as` wrapper, and the internal props
         * (`md` here) are stripped so they never leak to the DOM. `data-x` is the
         * consumer's arbitrary prop under test, not a planted target.
         */
        const { container } = render(RootHarness, {
            md,
            as: 'article',
            'data-x': 'y',
        });
        const wrapper = container.querySelector('article');

        expect(wrapper).not.toBeNull();
        expect(wrapper?.getAttribute('data-x')).toBe('y');
        expect(wrapper?.hasAttribute('md')).toBe(false);
    });
});
