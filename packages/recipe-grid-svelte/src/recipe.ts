import { parse as parseRecipe } from '@wendall911/recipe-grid';
import type { RecipeModel } from '@wendall911/recipe-grid';

/*
 * The driver. A class constructed from the recipe md: the core parse() runs
 * once in the constructor and its static result (title / description / meta /
 * structure / root) is what the components render from. The parse is a single
 * compiler pass, so `parsed` is a plain field — not reactive. Client-side
 * reactivity (e.g. scaling) is a later, separate layer.
 */
export class RecipeRootState {

    parsed: RecipeModel;

    constructor(md: string) {
        this.parsed = this.parse(md);
    }

    parse(md: string): RecipeModel {
        return parseRecipe(md);
    }

}
