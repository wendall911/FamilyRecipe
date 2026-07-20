<script lang="ts">
    import type { StructureNode } from '@wendall911/recipe-grid';
    import RecipeNode from './RecipeNode.svelte';

    /*
     * The wrapper for the recipe-grid `remainder` part. It binds the node
     * that part emits: the element's tag, its marker, its data attributes, any
     * attributes, its text, and its children.
     */
    let { node }: { node: StructureNode } = $props();
</script>

<svelte:element
    this={node.tag}
    {...{ [node.part]: '' }}
    {...node.dataAttrs}
    {...node.attrs}
>
    {#if node.text !== undefined}{node.text}{/if}
    {#each node.children as child}
        <RecipeNode node={child} />
    {/each}
</svelte:element>

