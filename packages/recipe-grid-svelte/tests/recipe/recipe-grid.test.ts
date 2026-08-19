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
        const grid = container.querySelector('[data-recipe-grid-root] [data-recipe-grid-card]');

        expect(grid).not.toBeNull();
    });

    it('wraps a cross-file reference as an anchor carrying its attrs and text', () => {
        const { container } = render(GridHarness, { md });
        const ref = container.querySelector('[data-recipe-grid-recipe-reference] a');

        expect(ref?.tagName).toBe('A');
        expect(ref?.getAttribute('data-recipe-grid-target-slug')).toBe('pizza-dough');
        expect(ref?.getAttribute('title')).toBe("Dad's pizza dough.");
        expect(ref?.textContent).toContain('dough');
    });

    it('resolves a cross-file reference href from the path the consumer supplied', () => {
        const { container } = render(GridHarness, { md, path: '/recipe/{slug}' });
        const ref = container.querySelector('[data-recipe-grid-recipe-reference] a');

        expect(ref?.getAttribute('href')).toBe('/recipe/pizza-dough');
        expect(ref?.getAttribute('data-recipe-grid-target-slug')).toBe('pizza-dough');
    });

    it('substitutes the slug wherever it sits in the path', () => {
        const { container } = render(GridHarness, { md, path: '/recipe/{slug}/print' });
        const ref = container.querySelector('[data-recipe-grid-recipe-reference] a');

        expect(ref?.getAttribute('href')).toBe('/recipe/pizza-dough/print');
    });

    it('falls back to an inert but valid href when no path is supplied', () => {
        const { container } = render(GridHarness, { md });
        const ref = container.querySelector('[data-recipe-grid-recipe-reference] a');

        expect(ref?.getAttribute('href')).toBe('#pizza-dough');
    });

    it('hands a cross-file reference to the browser rather than a client router', () => {
        const { container } = render(GridHarness, { md, path: '/recipe/{slug}', rel: 'external' });
        const ref = container.querySelector('[data-recipe-grid-recipe-reference] a');

        expect(ref?.getAttribute('rel')).toBe('external');
    });

    it('wraps a deeply nested ingredient preserving its quantity and quoted literal', () => {
        const { container } = render(GridHarness, { md });
        const ingredient = container.querySelector(
            '[data-recipe-grid-ingredient][data-recipe-grid-uom-id="gram"]',
        );
        const scaled = ingredient?.querySelector('[data-recipe-grid-scaled-value]');
        const description = ingredient?.querySelector('[data-recipe-grid-ingredient-description]');

        expect(ingredient).not.toBeNull();
        expect(scaled?.getAttribute('data-recipe-grid-value')).toBe('250');
        expect(scaled?.textContent).toContain('250');
        expect(description?.textContent).toBe('lamb mince (10% fat)');
    });

    it('renders an ingredient line as the recipe authored it', () => {
        const { container } = render(GridHarness, { md });
        const ingredient = container.querySelector(
            '[data-recipe-grid-ingredient][data-recipe-grid-uom-id="gram"]',
        );

        expect(ingredient?.querySelector('p')?.textContent).toBe(
            '250g lamb mince (10% fat)',
        );
    });

    it('renders a unit name with the spacing the author wrote around it', () => {
        const { container } = render(GridHarness, { md });
        const ingredient = container.querySelector(
            '[data-recipe-grid-ingredient][data-recipe-grid-uom-id="clove"]',
        );
        const uom = ingredient?.querySelector('[data-recipe-grid-uom-name]');

        expect(ingredient?.querySelector('p')?.textContent).toBe('4 cloves garlic');
        expect(uom?.textContent).toBe('cloves');
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

