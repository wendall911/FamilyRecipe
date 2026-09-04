import { Recipe } from '@wendall911/recipe-grid-svelte';
import { readFile, readdir } from 'fs/promises';
import { watch } from 'fs';
import path from 'path';

export const prerender = false;
export const trailingSlash = 'always';

const CONTENT_DIR = path.resolve(process.cwd(), 'content/recipes');
const cache = new Map<string, { title: string; slug: string; md: string }>();

let watcherStarted = false;

function startWatcher() {
    if (watcherStarted) {
        return;
    }

    watcherStarted = true;

    watch(CONTENT_DIR, async (_eventType, filename) => {
        if (!filename?.endsWith('.md')) {
            return;
        }

        const slug = filename.replace(/\.md$/, '');

        cache.delete(slug);

        try {
            const raw = await readFile(path.join(CONTENT_DIR, filename), 'utf-8');
            const context = new Recipe.RecipeContext(raw);
            const { title, meta } = context.parsed;

            cache.set(slug, { title, slug: meta.slug, md: raw });
        }
        catch {}
    });
}

export async function load() {
    startWatcher();

    const files = (await readdir(CONTENT_DIR)).filter((f) => f.endsWith('.md'));
    const recipes: Record<string, { title: string; slug: string; md: string }> = {};
    const titleSlugs: { title: string; slug: string }[] = [];

    for (const file of files) {
      const slug = file.replace(/\.md$/, '');

      if (!cache.has(slug)) {
          const raw = await readFile(path.join(CONTENT_DIR, file), 'utf-8');
          const context = new Recipe.RecipeContext(raw);
          const { title, meta } = context.parsed;

          cache.set(slug, { title, slug: meta.slug, md: raw });
      }

      const entry = cache.get(slug)!;

      recipes[entry.slug] = entry;
      titleSlugs.push({ title: entry.title, slug: entry.slug });
    }

    return { recipes, titleSlugs };
}