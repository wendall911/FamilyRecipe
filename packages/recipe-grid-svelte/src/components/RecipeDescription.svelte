<script lang="ts">
    import { getContext } from 'svelte';
    import type { RecipeContext } from '../recipe.js';

    /*
     * The recipe description, rendered outside the card. It is the model's
     * `description` string as a <p> -- not part of the walked structure, so a
     * consumer places it wherever the layout wants the intro prose. Read from
     * the Root's context; this part requires a <Recipe.Root> ancestor.
     */
    const recipe = getContext<RecipeContext>('recipe');
</script>

<svelte:element this={'p'}>{recipe.parsed.description}</svelte:element>
