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
     */
    const recipe = getContext<RecipeContext>('recipe');
    const node: StructureNode = recipe.parsed.structure;
</script>

{#snippet render(n: StructureNode)}
    <svelte:element
        this={n.tag}
        {...n.part !== undefined ? { [n.part]: '' } : {}}
        {...n.dataAttrs}
        {...n.attrs}
    >
        {#if n.text !== undefined}{n.text}{/if}
        {#each n.children as child}
            {@render render(child)}
        {/each}
    </svelte:element>
{/snippet}

{@render render(node)}
