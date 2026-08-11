<script lang="ts">
    import { getContext } from 'svelte';
    import type { StructureNode } from '@wendall911/recipe-grid';
    import type { RecipeContext } from '../recipe.js';

    /*
     * The recipe card. recipe-grid walks a recipe to a fully self-describing
     * StructureNode tree: every node carries its tag, its data-recipe-grid-*
     * marker, its data/aria attributes, its text, and its children. This
     * component wraps that tree as DOM one node at a time -- it invents nothing
     * and dispatches on nothing, because every node renders the same way. The
     * data-* markers ride through, so a consumer styles or binds against the
     * rendered card without this component knowing what any part means.
     *
     * The structure node comes from the Root's context (like Title/Description
     * read their pieces); this part requires a <Recipe.Root> ancestor.
     *
     * A cross-file reference is the one node carrying a slug rather than a
     * destination: the core cannot know how an edge resolves, so it emits the
     * target and stops. The Root's `path` is the consumer's answer, `{slug}`
     * substituted for this node's target.
     *
     * `rel="external"` rides with it. A card is composed at runtime, not by a
     * router's route table, so a client router that intercepts the click has
     * nothing to navigate to and leaves the URL changed with the page behind.
     * Handing the link to the browser is what makes it a link; a consumer who
     * wants otherwise sets their own `rel`, which spreads after this.
     */
    const recipe = getContext<RecipeContext>('recipe');

    const REFERENCE_PART = 'data-recipe-grid-recipe-reference';
    const TARGET_SLUG = 'data-recipe-grid-target-slug';

    function href(n: StructureNode): Record<string, string> {
        if (n.part !== REFERENCE_PART) return {};

        const slug = n.dataAttrs?.[TARGET_SLUG];

        if (slug === undefined) return {};

        return { href: recipe.path.replace('{slug}', slug), rel: 'external' };
    }

    // Pure JavaScript tree-walker to merge props and resolve paths
    function buildTree(n: StructureNode): any {
        return {
            tag: n.tag,
            props: {
                ...n.part !== undefined ? { [n.part]: '' } : {},
                ...n.dataAttrs,
                ...href(n),
                ...n.attrs
            },
            text: n.text,
            children: n.children?.map(child => buildTree(child)) || []
        };
    }

    /*
     * Reactively track the context structure.
     * When the host router changes the route, recipe.parsed.structure updates, 
     * and this rune immediately rebuilds the component tree.
     */
    const reactiveTree = $derived(buildTree(recipe.parsed.structure));
</script>

{#snippet render(n: any)}
    <svelte:element this={n.tag} {...n.props}>
        {#if n.text !== undefined}{n.text}{/if}
        {#each n.children as child}
            {@render render(child)}
        {/each}
    </svelte:element>
{/snippet}

{@render render(reactiveTree)}
