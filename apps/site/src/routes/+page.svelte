<script lang="ts">
    import { Recipe } from '@wendall911/recipe-grid-svelte';

    // Eager glob: filename -> raw md. One headless parse per file gives the
    // title + slug for the link; the slug is the binding's own (meta.slug),
    // so it matches whatever the recipe route resolves against.
    const files = import.meta.glob('$content/recipes/*.md', {
        eager: true,
        query: '?raw',
        import: 'default',
    }) as Record<string, string>;

    const recipes = Object.values(files).map((md) => {
        const { title, meta } = new Recipe.RecipeContext(md).parsed;
        return { title, slug: meta.slug };
    });
</script>

<main>
    <ul>
        {#each recipes as { title, slug } (slug)}
            <li><a href="/recipe/{slug}">{title}</a></li>
        {/each}
    </ul>
</main>
