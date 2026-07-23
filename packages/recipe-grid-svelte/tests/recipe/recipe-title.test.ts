import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import { loadFixture } from '../util/loadFixture.js';
import TitleHarness from './TitleHarness.svelte';

const md = loadFixture('turkish-pizza.md');
const title = 'Red Pepper and Lamb Lahmacun (Turkish Pizza)';

describe('Recipe.Title', () => {
    it('renders the title as an h1 by default', () => {
        const { container } = render(TitleHarness, { md });

        expect(container.querySelector('h1')?.textContent).toBe(title);
    });

    it('renders the raw title text when `as` is an empty string', () => {
        const { container } = render(TitleHarness, { md, as: '' });

        /*
         * Empty-string `as`: the else branch renders the title text with no
         * element. No h1, but the title is present as bare text.
         */
        expect(container.querySelector('h1')).toBeNull();
        expect(container.textContent).toContain(title);
    });
});
