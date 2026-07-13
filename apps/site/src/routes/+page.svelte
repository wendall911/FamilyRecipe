<script lang="ts">
    import { resolve } from '$app/paths';
    import { loadRecipe } from '@wendall911/recipe-grid-svelte';

    const files = import.meta.glob('$content/recipes/*.md', {
        eager: true,
        query: '?raw',
        import: 'default',
    }) as Record<string, string>;

    const recipes = Object.entries(files)
        .map(([path, md]) => {
            const slug = path.split('/').pop()!.replace(/\.md$/, '');
            return { slug, model: loadRecipe(md) };
        })
        .sort((a, b) => a.slug.localeCompare(b.slug));
</script>

<main>
    <ul>
        {#each recipes as recipe (recipe.slug)}
            <li>
                <a href={resolve(`/recipe/${recipe.slug}/`)}>
                    {recipe.model.title || recipe.slug}
                </a>
            </li>
        {/each}
    </ul>
</main>
