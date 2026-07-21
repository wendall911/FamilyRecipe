import { parse as parseRecipe } from '@wendall911/recipe-grid';
import type { RecipeModel } from '@wendall911/recipe-grid';

export function parse(md: string): RecipeModel {
    return parseRecipe(md);
}

export type { RecipeModel } from '@wendall911/recipe-grid';

export { default as RecipeGrid } from './components/RecipeGrid.svelte';
