import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/svelte';
import { loadFixture } from '../util/loadFixture.js';
import ScaleHarness from './ScaleHarness.svelte';
import {
    type Recipe,
} from '../../src/index.js';

const title = 'Scale Recipe';
const options = [
    { value: 0.5, label: '<sup>1</sup>/<sub>2</sub>X' },
    { value: 1, label: '1X' },
    { value: 2, label: '2X' },
] as Recipe.ScaleOption[];

describe('Recipe.Scale', () => {
    const md = loadFixture('turkish-pizza.md');

    it('renders a labelled group of radios, one per option', () => {
        const { container } = render(ScaleHarness, { md, title, options });
        const fieldset = container.querySelector('fieldset');

        expect(fieldset).not.toBeNull();
        expect(fieldset?.querySelector('legend')?.textContent).toBe(title);

        const radios = [...container.querySelectorAll<HTMLInputElement>('input[type="radio"]')];

        expect(radios).toHaveLength(options.length);
        expect(radios.map((radio) => radio.value)).toEqual(['0.5', '1', '2']);
        expect(new Set(radios.map((radio) => radio.name))).toEqual(
            new Set(['recipe-grid-scale-turkish-pizza']),
        );

        // Every radio is its own label's control, so the label text names it.
        const labels = [...container.querySelectorAll('label')];

        expect(labels).toHaveLength(options.length);
        expect(labels.map((label) => label.textContent)).toEqual(['1/2X', '1X', '2X']);

        // `label` is passed through `@html`, so markup arrives as nodes, not text.
        expect(labels[0]?.querySelector('sup')?.textContent).toBe('1');
        expect(labels[0]?.querySelector('sub')?.textContent).toBe('2');
    });

    it('selects scale 1 by default', () => {
        const { container } = render(ScaleHarness, { md, title, options });
        const radios = [...container.querySelectorAll<HTMLInputElement>('input[type="radio"]')];

        expect(radios.map((radio) => radio.checked)).toEqual([false, true, false]);
    });

    it('hands the picked scale to `onValueChange`', async () => {
        const onValueChange = vi.fn();
        const { container } = render(ScaleHarness, { md, title, options, onValueChange });

        await fireEvent.click(container.querySelector('input[value="2"]')!);

        // The option's own value, not the DOM's stringified copy of it.
        expect(onValueChange).toHaveBeenCalledTimes(1);
        expect(onValueChange).toHaveBeenCalledWith(2);
    });

    it('renders nothing for a recipe that does not scale', () => {
        const fixed = loadFixture('pizza-dough.md');
        const { container } = render(ScaleHarness, { md: fixed, title, options });

        /*
         * Anchors only, from Root and the harness boundary. Assert the exact
         * string rather than the absence of a fieldset: a negative check passes
         * on any wrong output that merely isn't a fieldset, and would not catch
         * the control emitting something for a recipe that does not scale.
         */
        expect(container.innerHTML).toBe('<!----><!----><!----><!----><!----><!---->');
    });

    /*
     * A mis-wired control is a bug on every card that uses it, so the component
     * refuses to render rather than degrade. The throw leaves the component and
     * the consumer's boundary catches it; the harness boundary stands in for
     * that consumer here. Assert the surfaced error name, not an absence: a card
     * that failed to render for any other reason would pass an emptiness check.
     */
    const badConfigs: [string, string, Recipe.ScaleOption[], unknown][] = [
        ['a blank title', '   ', options, undefined],
        ['no options', title, [], undefined],
        ['an option with no numeric value', title, [{ value: NaN, label: '1X' }], undefined],
        ['an option with a blank label', title, [{ value: 1, label: '   ' }], undefined],
        ['duplicate option values', title, [
            { value: 1, label: '1X' },
            { value: 1, label: 'also 1X' },
        ], undefined],
        ['an `onValueChange` that is not callable', title, options, 'nope'],
    ];

    it.each(badConfigs)('refuses to render given %s', (_case, badTitle, badOptions, badOnValueChange) => {
        const { container } = render(ScaleHarness, {
            md,
            title: badTitle,
            options: badOptions,
            onValueChange: badOnValueChange as Recipe.OnScaleChangeFn<number>,
        });

        expect(container.querySelector('[data-test-error]')?.textContent).toBe('RecipeScaleError');
    });

});
