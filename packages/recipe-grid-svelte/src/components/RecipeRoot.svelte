<script lang="ts">
    import { setContext } from 'svelte';
    import { RecipeContext } from '../recipe.js';

    /*
     * The recipe card container ("bag of holding"). Constructs the driver from
     * the `md` string (one parse pass) and exposes the whole parsed model via
     * context so Title / Description / Grid read the pieces they need. Also a
     * passthrough container for whatever the consumer places inside.
     *
     * The whole model rides in context -- including the entire `meta` bag --
     * carried opaquely, not narrowed to known keys. First-class components
     * (scaling / units, later) reach into the object for what they need; a
     * consumer can grab any author-added metadata key and compose with it.
     *
     * `as` is the wrapper element tag. It defaults to nullish so no wrapper is
     * rendered at all (svelte:element with a nullish `this` renders nothing) --
     * the consumer's own placed markup is the markup, with no semantic layer
     * forced on them. Pass e.g. `as="article"` to opt into a wrapper element.
     */
    let { md, as, children, ...rest }: {
        md: string;
        as?: string;
        children?: import('svelte').Snippet;
    } & Record<string, unknown> = $props();

    // svelte-ignore state_referenced_locally
    const recipe = new RecipeContext(md);
    setContext('recipe', recipe);

    const mergedProps = $derived({ ...rest });
</script>

{#if as}
    <svelte:element this={as} {...mergedProps}>
        {@render children?.()}
    </svelte:element>
{:else}
    {@render children?.()}
{/if}
