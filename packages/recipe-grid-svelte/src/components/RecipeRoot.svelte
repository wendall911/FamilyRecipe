<script lang="ts">
    import { setContext } from 'svelte';
    import { RecipeContext } from '../recipe.js';

    /*
     * The recipe card container ("bag of holding"). Constructs the driver from
     * the `md` string (one parse pass) and exposes the whole parsed model via
     * context so Title / Description / Grid read the pieces they need. Also a
     * passthrough container for whatever the consumer places inside.
     *
     * The whole model rides in context, including the entire `meta` bag, is 
     * carried opaquely, not narrowed to known keys. First-class components
     * (scaling / units, later) reach into the object for what they need so a
     * consumer can grab any author-added metadata key and compose with it.
     *
     * `as` is the wrapper element tag. It defaults to nullish so no wrapper is
     * rendered at all (svelte:element with a nullish `this` renders nothing).
     * Pass e.g. `as="article"` to opt into a wrapper element.
     *
     * `path` is where a cross-file recipe reference points. The core emits the
     * raw slug and nothing else, and needs an href, `{slug}` substituted
     * for the target. `/recipe/{slug}` and `/recipe/{slug}/print` both work,
     * as does any absolute URL. It defaults to `#{slug}`: an anchor with a
     * valid href is focusable and a valid link.
     * 
     * `rel` is so users can bypass the dumbass decisions of the Svelte 5 core
     * team to not honor the way links work so their micro-benchmark can be
     * marginally faster.
     */
    let { md, as, path = '#{slug}', rel = '', children, ...rest }: {
        md: string | RecipeContext;
        as?: string;
        path?: string;
        rel?: string;
        children?: import('svelte').Snippet;
    } & Record<string, unknown> = $props();

    // svelte-ignore state_referenced_locally
    if (md instanceof RecipeContext) {
        if (path) {
            md.path = path;
        }
        if (rel) {
            md.rel = rel;
        }

        setContext('recipe', md);
    }
    else {
        setContext('recipe', new RecipeContext(md, path, rel));
    }

    const mergedProps = $derived({ ...rest });
</script>

{#if as}
    <svelte:element this={as} {...mergedProps}>
        {@render children?.()}
    </svelte:element>
{:else}
    {@render children?.()}
{/if}
