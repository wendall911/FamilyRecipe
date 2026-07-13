import { error } from '@sveltejs/kit';
import { loadRecipe } from '@wendall911/recipe-grid-svelte';
import type { EntryGenerator, PageLoad } from './$types';

const files = import.meta.glob('$content/recipes/*.md', {
    eager: true,
    query: '?raw',
    import: 'default',
}) as Record<string, string>;

const bySlug = new Map(
    Object.entries(files).map(([path, md]) => [
        path.split('/').pop()!.replace(/\.md$/, ''),
        md,
    ])
);

export const entries: EntryGenerator = () =>
    [...bySlug.keys()].map((slug) => ({ slug }));

export const load: PageLoad = ({ params }) => {
    const md = bySlug.get(params.slug);
    if (md === undefined) error(404, 'Recipe not found');
    return { model: loadRecipe(md) };
};
