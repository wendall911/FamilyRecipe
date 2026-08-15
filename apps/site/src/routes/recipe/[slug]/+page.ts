import { error } from '@sveltejs/kit';
import { Recipe } from '@wendall911/recipe-grid-svelte';
import type { PageLoad } from './$types';

const files = import.meta.glob('$content/recipes/*.md', {
    eager: true,
    query: '?raw',
    import: 'default',
}) as Record<string, string>;

export const load: PageLoad = ({ params }) => {
    const md = Object.values(files).find(
        (md) => new Recipe.RecipeContext(md).parsed.meta.slug === params.slug,
    );

    if (md === undefined) {
        error(404, 'Recipe not found');
    }

    return { md };
};
