<script lang="ts">
    import { Recipe } from '../../src/index.js';

    let { md }: { md: string } = $props();
</script>

<Recipe.Root {md}>
    <Recipe.Title />
    <Recipe.Grid />
</Recipe.Root>
