import { parse } from '@wendall911/recipe-grid';
import type { RecipeModel } from '@wendall911/recipe-grid';

/**
 * Parse recipe markdown into the model the components render.
 *
 * This is the Svelte package's own entry point for the dynamic/runtime path:
 * a consumer feeds raw `.md` and gets back a model, without importing the
 * parser directly. `@wendall911/recipe-grid` is a private dependency of this
 * package — it is not re-exported, keeping the parser's public surface
 * independent of the Svelte renderer.
 *
 * (The static/build path — compiling `.md` files into components — is a
 * separate integration; this loader covers dynamic rendering.)
 */
export function loadRecipe(md: string): RecipeModel {
  return parse(md);
}
