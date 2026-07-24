<script lang="ts">
    import { Recipe } from '@wendall911/recipe-grid-svelte';

    let { data } = $props();
</script>

<Recipe.Root md={data.md} as="article">
    <Recipe.Title />
    <Recipe.Description />
    <Recipe.Grid />
</Recipe.Root>
