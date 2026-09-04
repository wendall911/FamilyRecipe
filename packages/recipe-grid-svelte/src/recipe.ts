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
     * target.
     */
    private _path: string;
    private _rel?: string;

    constructor(md: string, path = '#{slug}', rel?: string) {
        this.parsed = this.parse(md);
        this._path = path;
        this._rel = rel;
    }

    get path(): string {
        return this._path;
    }

    set path(path: string) {
        this._path = path;
    }

    get rel(): string | undefined {
        return this._rel;
    }

    set rel(rel: string) {
        this._rel = rel;
    }

    parse(md: string): RecipeModel {
        return parseRecipe(md);
    }

}
