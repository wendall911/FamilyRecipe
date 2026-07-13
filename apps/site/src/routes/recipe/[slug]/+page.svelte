<script lang="ts">
    import { Recipe } from '@wendall911/recipe-grid-svelte';

    let { data } = $props();
    const model = $derived(data.model);
</script>

<main>
    <section>
        <Recipe.Root {model}>
            <Recipe.Title />
            <Recipe.Servings />
            <Recipe.Grid />
        </Recipe.Root>
    </section>
</main>
