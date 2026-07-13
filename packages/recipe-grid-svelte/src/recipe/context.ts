import { getContext, setContext } from 'svelte';
import type { RecipeModel } from '@wendall911/recipe-grid';

/**
 * Shared state for a Recipe. `Recipe.Root` provides it; the other parts
 * (`Grid`, `Title`, `Servings`) read from it.
 *
 * - `model` is the parsed recipe (the interface from @wendall911/recipe-grid).
 * - `scale` is the reactive serving multiplier that `Servings` sets and
 *   `Grid` consumes. Grid scaling is a no-op until the parser produces a
 *   scalable model; the wiring is in place regardless.
 */
export type RecipeContext = {
  readonly model: RecipeModel;
  /** Serving multiplier (1 = as written). Reactive `$state` in Root. */
  scale: number;
};

const KEY = Symbol('recipe');

export function setRecipeContext(ctx: RecipeContext): void {
  setContext(KEY, ctx);
}

export function getRecipeContext(): RecipeContext {
  return getContext(KEY);
}
