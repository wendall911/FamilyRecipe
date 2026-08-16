<script lang="ts">
    import { getContext } from 'svelte';
    import type { StructureNode } from '@wendall911/recipe-grid';
    import type { RecipeContext } from '../recipe.js';

    /*
     * The recipe card. recipe-grid walks a recipe to a fully self-describing
     * StructureNode tree: every node carries its tag, its data-recipe-grid-*
     * marker, its data/structure/styling attributes, its text, and its children.
     * This component wraps that tree as DOM one node at a time
     * 
     * A cross-file reference is the one node carrying a slug rather than a
     * destination: the core cannot know how an edge resolves, so it emits the
     * target and stops. The Root's `path` is the consumer's answer, `{slug}`
     * substituted for this node's target.
     *
     */
    const recipe = getContext<RecipeContext>('recipe');

    const REFERENCE_PART = 'data-recipe-grid-recipe-reference';
    const TARGET_SLUG = 'data-recipe-grid-target-slug';

    function href(n: StructureNode): Record<string, string> {
        if (n.part !== REFERENCE_PART) return {};

        const slug = n.dataAttrs?.[TARGET_SLUG];

        if (slug === undefined) return {};

        return {
            href: recipe.path.replace('{slug}', slug),
            ...(recipe.rel ? { rel: recipe.rel } : {}),
        };
    }

    /*
     * Pure JavaScript tree-walker to merge props and resolve paths.
     *
     * Build tree here so that it is bound reactively and all content
     * is faithfully carried.
     */
    function buildTree(n: StructureNode): any {
        return {
            tag: n.tag,
            props: {
                ...n.part !== undefined ? { [n.part]: '' } : {},
                ...n.dataAttrs,
                ...href(n),
                ...n.attrs
            },
            /*
             * This node's own text, then each child.
             * Nodes can have a mixture of text and child dom nodes.
             */
            content: [
                ...n.text !== undefined ? [n.text] : [],
                ...(n.children ?? []).map(child =>
                    child.tag === undefined ? child.text ?? '' : buildTree(child)
                )
            ]
        };
    }

    /*
     * Reactively track the context structure.
     * When the host router changes the route, recipe.parsed.structure updates, 
     * and this rune immediately rebuilds the component tree.
     */
    const reactiveTree = $derived(buildTree(recipe.parsed.structure));
</script>

{#snippet render( n: any)}
    <svelte:element this={n.tag} {...n.props}>
        {#each n.content as piece}
            {#if typeof piece === 'string'}
                {piece}
            {:else}
                {@render render(piece)}
            {/if}
        {/each}
    </svelte:element>
{/snippet}

{@render render(reactiveTree)}
