<script lang="ts">
    import { getContext } from 'svelte';
    import type { RecipeContext } from '../recipe.js';

    /*
     * The recipe title, rendered outside the card. It is the model's `title`
     * string -- not part of the walked structure, so a consumer places it
     * wherever the layout wants the heading. Read from the Root's context; this
     * part requires a <Recipe.Root> ancestor.
     *
     * `as` is the heading tag, defaulting to `h1`. Heading level is
     * context-dependent (a card embedded deep in a page may want `h2`), so the
     * consumer can override it without this component forcing a level.
     */
    let { as = 'h1' }: { as?: string } = $props();

    const recipe = getContext<RecipeContext>('recipe');
</script>

<svelte:element this={as}>{recipe.parsed.title}</svelte:element>
