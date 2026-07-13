import Root from './Root.svelte';
import Grid from './Grid.svelte';
import Title from './Title.svelte';
import Servings from './Servings.svelte';

/**
 * Dotted-namespace component set, bits-ui style:
 *   <Recipe.Root {model}>
 *     <Recipe.Title />
 *     <Recipe.Servings />
 *     <Recipe.Grid />
 *   </Recipe.Root>
 *
 * `Root` provides shared context (model + reactive scale). `Grid` is
 * model-driven; `Title` is data-bound; `Servings` is a decoration control.
 */
export const Recipe = { Root, Grid, Title, Servings };

export type { RecipeContext } from './context';
