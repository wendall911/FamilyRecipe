import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import { loadFixture } from '../util/loadFixture.js';
import DescriptionHarness from './DescriptionHarness.svelte';

const md = loadFixture('turkish-pizza.md');
const description = 'Thin, crisp Turkish flatbreads under a spiced red pepper and lamb topping.';

describe('Recipe.Description', () => {
    it('renders the description with no wrapper by default', () => {
        const { container } = render(DescriptionHarness, { md });

        expect(container.querySelector('p')?.textContent).toBe(description);
    });

    it('wraps the description in the element `as` names', () => {
        const { container } = render(DescriptionHarness, { md, as: 'div' });
        const wrapper = container.querySelector('div');

        expect(wrapper?.querySelector('p')?.textContent).toBe(description);
    });
});
