import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import { loadFixture } from '../util/loadFixture.js';
import GridHarness from './GridHarness.svelte';

const md = loadFixture('turkish-pizza.md');

/*
 * Faithful-wrap coverage for turkish-pizza: the structure is the core's, so
 * these assert only that Grid wraps what is there without altering it. A few
 * top-level and deeply-nested wrap points, chosen off the real rendered output.
 */
describe('Recipe.Grid faithful wrap', () => {
    it('wraps the card root carrying its scaling metadata', () => {
        const { container } = render(GridHarness, { md });
        const root = container.querySelector('[data-recipe-grid-root]');

        expect(root).not.toBeNull();
        expect(root?.getAttribute('data-recipe-grid-scaling-type')).toBe('servings');
        expect(root?.getAttribute('data-recipe-grid-base')).toBe('4');
    });

    it('wraps the grid container inside the root', () => {
        const { container } = render(GridHarness, { md });
        const grid = container.querySelector('[data-recipe-grid-root] [data-recipe-grid-grid]');

        expect(grid).not.toBeNull();
    });

    it('wraps a cross-file reference as an anchor carrying its attrs and text', () => {
        const { container } = render(GridHarness, { md });
        const ref = container.querySelector('[data-recipe-grid-recipe-reference]');

        expect(ref?.tagName).toBe('A');
        expect(ref?.getAttribute('data-recipe-grid-target-slug')).toBe('pizza-dough');
        expect(ref?.getAttribute('title')).toBe("Dad's pizza dough.");
        expect(ref?.textContent).toContain('dough');
    });

    it('wraps a deeply nested ingredient preserving its quantity and quoted literal', () => {
        const { container } = render(GridHarness, { md });
        const ingredient = container.querySelector(
            '[data-recipe-grid-ingredient][data-recipe-grid-value="250"]',
        );
        const scaled = ingredient?.querySelector(
            '[data-recipe-grid-quantity] [data-recipe-grid-scaled-value]',
        );

        expect(ingredient).not.toBeNull();
        expect(scaled?.getAttribute('data-recipe-grid-value')).toBe('250');
        expect(scaled?.textContent).toContain('250');
        expect(ingredient?.textContent).toContain('lamb mince (10% fat)');
    });

    it('wraps the sub-recipe header as the h2 tag the structure carries', () => {
        const { container } = render(GridHarness, { md });
        const header = container.querySelector('[data-recipe-grid-sub-recipe-header]');

        expect(header?.tagName).toBe('H2');
        expect(header?.textContent).toContain('Topping');
    });

    it('wraps an interpolated value as a scaled-value node beside its literal text', () => {
        const { container } = render(GridHarness, { md });
        const paragraphs = [...container.querySelectorAll('p')];
        const step = paragraphs.find((p) => p.textContent?.includes('divide into'));
        const scaled = step?.querySelector('[data-recipe-grid-scaled-value]');

        expect(step).not.toBeUndefined();
        expect(scaled?.getAttribute('data-recipe-grid-value')).toBe('4');
        expect(scaled?.textContent).toContain('4');
    });
});

