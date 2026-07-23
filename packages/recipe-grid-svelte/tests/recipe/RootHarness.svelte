<script lang="ts">
    import { Recipe } from '../../src/index.js';

    let { md, ...rest }: { md: string } & Record<string, unknown> = $props();
</script>

<Recipe.Root {md} {...rest}>
    <Recipe.Title />
</Recipe.Root>
