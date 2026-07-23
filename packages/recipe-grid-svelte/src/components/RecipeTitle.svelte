<script lang="ts">
    import { getContext } from 'svelte';
    import type { RecipeContext } from '../recipe.js';

    /*
     * The recipe title, rendered outside the card. It is the model's `title`
     * string -- not part of the walked structure, so a consumer places it
     * wherever the layout wants the heading. Read from the Root's context; this
     * part requires a <Recipe.Root> ancestor.
     *
     * `as` is the heading tag, a string defaulting to `h1` (the semantically
     * correct heading element). Heading level is context-dependent (a card
     * embedded deep in a page may want `h2`), so the consumer can override it.
     * Passing an empty string `''` (a falsy string) opts out of the element
     * entirely and renders the raw title text -- `undefined` would fall back to
     * the `h1` default. Matches Root's wrapper-or-nothing behavior.
     */
    let { as = 'h1' }: { as?: string } = $props();

    const recipe = getContext<RecipeContext>('recipe');
</script>

{#if as}
    <svelte:element this={as}>{recipe.parsed.title}</svelte:element>
{:else}
    {recipe.parsed.title}
{/if}
