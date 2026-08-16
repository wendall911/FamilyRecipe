<script lang="ts">
    import { getContext } from 'svelte';
    import type { RecipeContext } from '../recipe.js';

    /*
     * The recipe description, rendered outside the card. It is the model's
     * `description` string -- not part of the walked structure, so a consumer
     * places it wherever the layout wants the intro prose. Read from the Root's
     * context; this part requires a <Recipe.Root> ancestor.
     *
     * `as` is the element tag, a string defaulting to the authored <p>
     * (the semantically correct element for intro prose).
     * Passing a tag `'div'` allows the description to be wrapped as needed.
     */
    let { as = '' }: { as?: string } = $props();

    const recipe = getContext<RecipeContext>('recipe');
</script>

{#if as}
    <svelte:element this={as}>{@html recipe.parsed.description}</svelte:element>
{:else}
    {@html recipe.parsed.description}
{/if}
