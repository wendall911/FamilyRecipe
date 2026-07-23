<script lang="ts">
    import { getContext } from 'svelte';
    import type { RecipeContext } from '../recipe.js';

    /*
     * The recipe description, rendered outside the card. It is the model's
     * `description` string -- not part of the walked structure, so a consumer
     * places it wherever the layout wants the intro prose. Read from the Root's
     * context; this part requires a <Recipe.Root> ancestor.
     *
     * `as` is the element tag, a string defaulting to `p` (the semantically
     * correct element for intro prose). Passing an empty string `''` (a falsy
     * string) opts out of the element entirely and renders the raw description
     * text -- `undefined` would fall back to the `p` default. Matches Root's
     * wrapper-or-nothing behavior and Title's.
     */
    let { as = 'p' }: { as?: string } = $props();

    const recipe = getContext<RecipeContext>('recipe');
</script>

{#if as}
    <svelte:element this={as}>{recipe.parsed.description}</svelte:element>
{:else}
    {recipe.parsed.description}
{/if}
