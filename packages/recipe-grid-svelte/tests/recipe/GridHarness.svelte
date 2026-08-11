<script lang="ts">
    import { Recipe } from '../../src/index.js';

    let { md, path }: { md: string; path?: string } = $props();
</script>

<Recipe.Root {md} {path}>
    <Recipe.Grid />
</Recipe.Root>
