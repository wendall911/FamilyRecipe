<script lang="ts">
    import { Recipe } from '../../src/index.js';

    let { md, as }: { md: string; as?: string } = $props();
</script>

<Recipe.Root {md}>
    <Recipe.Title {as} />
</Recipe.Root>
