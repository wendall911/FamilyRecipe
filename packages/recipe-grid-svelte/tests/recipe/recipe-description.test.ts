import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import { loadFixture } from '../util/loadFixture.js';
import DescriptionHarness from './DescriptionHarness.svelte';

const md = loadFixture('turkish-pizza.md');
const description = 'Thin, crisp Turkish flatbreads under a spiced red pepper and lamb topping.';

describe('Recipe.Description', () => {
    it('renders the description as a p by default', () => {
        const { container } = render(DescriptionHarness, { md });

        expect(container.querySelector('p')?.textContent).toBe(description);
    });

    it('renders the raw description text when `as` is an empty string', () => {
        const { container } = render(DescriptionHarness, { md, as: '' });

        /*
         * Empty-string `as`: the else branch renders the description text with
         * no element. No p, but the description is present as bare text.
         */
        expect(container.querySelector('p')).toBeNull();
        expect(container.textContent).toContain(description);
    });
});
