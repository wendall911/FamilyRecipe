<script lang="ts">
    import { Recipe } from '../../src/index.js';

    let { md, ...rest }: { md: string } & Record<string, unknown> = $props();
</script>

<svelte:boundary>
    <Recipe.Root {md} {...rest}>
        <Recipe.Title />
    </Recipe.Root>

    {#snippet failed(error)}
        <p data-test-error>{(error as Error).name}</p>
    {/snippet}
</svelte:boundary>
