import { parse as parseRecipe } from '@wendall911/recipe-grid';
import type { RecipeModel } from '@wendall911/recipe-grid';

/*
 * The driver. A class constructed from the recipe md: the core parse() runs
 * once in the constructor and its static result (title / description / meta /
 * structure / root) is what the components render from. The parse is a single
 * compiler pass, so `parsed` is a plain field — not reactive. Client-side
 * reactivity (e.g. scaling) is a later, separate layer.
 */
export class RecipeContext {

    parsed: RecipeModel;

    /*
     * Where a cross-file recipe reference points, `{slug}` substituted for the
     * target. The core emits the raw slug because it cannot know how an edge
     * resolves; this is the consumer's answer, carried alongside the model. A
     * route, an in-page anchor, another site -- the reference is rendered
     * `rel="external"`, so nothing here is resolved against a router.
     */
    path: string;

    constructor(md: string, path = '#{slug}') {
        this.parsed = this.parse(md);
        this.path = path;
    }

    parse(md: string): RecipeModel {
        return parseRecipe(md);
    }

}
