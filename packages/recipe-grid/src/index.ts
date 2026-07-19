import { parse as parseGrammar } from '../generated/grammar.generated.js';
import { extractRecipe, type RecipeMeta } from './markdown.ts';
import { compile } from './compiler.ts';
import { walkRecipe } from './structure/walk.ts';
import { build, type ElementNode } from './structure/build.ts';

/**
 * The public result of parsing a recipe: its title, its recipe-level metadata,
 * and the rendered DOM chunk. A headless consumer mounts `root` and reads `meta`
 * for scaling; `meta` carries everything the extraction layer resolved and grows
 * as the model does.
 */
export interface RecipeModel {
    // The recipe title (the `# ...` heading), or '' when the source has none.
    title: string;
    // Recipe-level metadata: slug, scaling, and anything the model adds later.
    meta: RecipeMeta;
    // The rendered element tree: a serialisable DOM chunk the consumer mounts.
    root: ElementNode;
}

/**
 * Parse a recipe `.md` source into the public {@link RecipeModel}: extract the
 * frontmatter + body, compile the body to the DAG, walk it to render structure,
 * and build the element tree.
 */
export function parse(md: string): RecipeModel {
    const { title, blocks, meta } = extractRecipe(md);
    const recipe = compile(parseGrammar(blocks[0]), meta);
    const root = build(walkRecipe(recipe));
    return {
        title: title ?? '',
        meta,
        root,
    };
}
