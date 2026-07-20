import { parse as parseRecipe } from '@wendall911/recipe-grid';
import type { RecipeModel } from '@wendall911/recipe-grid';

/*
 * The single entry point for the Svelte binding. A consumer imports everything
 * from here and never has to reach into recipe-grid directly.
 *
 * `parse` is the binding's own function, matching recipe-grid's signature and
 * delegating to it: markdown source in, RecipeModel out. Owning it (rather than
 * re-exporting recipe-grid's) keeps this package the one door for a Svelte
 * consumer, so there is no reason to depend on recipe-grid alongside it.
 */
export function parse(md: string): RecipeModel {
    return parseRecipe(md);
}

export type { RecipeModel } from '@wendall911/recipe-grid';

export { default as RecipeNode } from './recipe/RecipeNode.svelte';
