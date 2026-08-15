<script lang="ts">
    import {
        Recipe
    } from '../../src/index.js';

    let { md, title, options, onValueChange }: {
        md: string;
        title: string;
        options: Recipe.ScaleOption[];
        onValueChange?: Recipe.OnScaleChangeFn<number>;
    } = $props();
</script>

<svelte:boundary>
    <Recipe.Root {md}>
        <Recipe.Scale {title} {options} {onValueChange} />
    </Recipe.Root>

    {#snippet failed(error)}
        <p data-test-error>{(error as Error).name}</p>
    {/snippet}
</svelte:boundary>
