<script lang="ts">
    import { setContext } from 'svelte';
    import { RecipeRootState } from '../recipe.js';

    /*
     * The recipe card container ("bag of holding"). Constructs the driver from
     * the `md` string (one parse pass) and exposes it via context so Title /
     * Description / Grid can read the parsed pieces. Also a passthrough
     * container for whatever the consumer places inside.
     */
    let { md, children, ...rest }: {
        md: string;
        children?: import('svelte').Snippet;
    } & Record<string, unknown> = $props();

    const recipe = new RecipeRootState(md);
    setContext('recipe', recipe);

    const mergedProps = $derived({ ...rest });
</script>

<div {...mergedProps}>
    {@render children?.()}
</div>
