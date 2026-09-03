<script lang="ts">
    import { Recipe } from '@wendall911/recipe-grid-svelte';
    import Fraction from 'fraction.js';
    import { page } from '$app/state';

    let {
        data
    } = $props();

    const title = 'Scale Recipe';
    const options: Recipe.ScaleOption[] = [
        { value: 0.5, label: '<sup>1</sup>/<sub>2</sub>X' },
        { value: 1, label: '1X' },
        { value: 2, label: '2X' },
    ];

    let scale = $state(1);
    let card: HTMLElement;
    let applied = 1;

    /*
     * Rescale handler. Recipe.Grid owns its subtree, so this reaches into
     * the rendered card rather than re-rendering: each scaled-value element
     * carries its unscaled base, so a rewrite is base x scale, exact.
     *
     * The base carries the kind the author wrote -- a bare number stays a
     * number, {numerator, denominator} stays a fraction -- and nothing is
     * rewritten until the scale actually changes.
     */
    $effect(() => {

        const factor = scale;

        if (factor === applied) {
            return;
        }

        applied = factor;

        for (const el of card.querySelectorAll<HTMLElement>(
            '[data-recipe-grid-scaled-value]',
        )) {
            const raw = el.dataset.recipeGridValue;

            if (raw === undefined) {
                continue;
            }

            const base = JSON.parse(raw);

            el.textContent =
                typeof base === 'number'
                    ? String(new Fraction(base).mul(factor).valueOf())
                    : new Fraction(base.numerator, base.denominator)
                          .mul(factor)
                          .toFraction(true);
        }
    });
</script>

<svelte:head>
    <title>{page.data.recipes[data.slug]?.title ?? 'Not found'}</title>
</svelte:head>

<div bind:this={card} id="card">
    <Recipe.Root md={page.data.recipes[data.slug].md} as="article" path={'/recipe/{slug}'} rel={'external'}>
        <Recipe.Title />
        <Recipe.Description />
        <Recipe.Scale {title} {options} onValueChange={(value) => (scale = value)} />
        <Recipe.Grid />
    </Recipe.Root>
</div>
