<script lang="ts">
    import { Recipe } from '../../src/index.js';

    let { md, path, rel }: {
        md: string;
        path?: string;
        rel?: string;
    } = $props();
</script>

<Recipe.Root {md} {path} {rel}>
    <Recipe.Grid />
</Recipe.Root>
