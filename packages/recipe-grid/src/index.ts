import { parse as parseGrammar } from '../generated/grammar.generated.js';
import { extractRecipe, type RecipeMeta } from './markdown.ts';
import { compile } from './compiler.ts';
import { walkRecipe, type StructureNode } from './structure/walk.ts';
import { build, type ElementNode } from './structure/build.ts';

/*
 * Re-export the public vocabulary so a binding author (or any consumer) has the
 * whole surface from one entry point, without spelunking the internals:
 *   - RecipeMeta            recipe-level metadata (slug, scaling).
 *   - StructureNode, Extent the render-structure tree: a complete element tree a
 *                           framework binding renders one node at a time.
 *   - ElementNode           the built element tree: a frameworkless DOM chunk.
 */
export type { RecipeMeta } from './markdown.ts';
export type { StructureNode, Extent } from './structure/walk.ts';
export type { ElementNode } from './structure/build.ts';

/**
 * The public result of parsing a recipe: its title, its recipe-level metadata,
 * and both render trees. `structure` is the framework-neutral render structure a
 * binding maps to components; `root` is the built element tree, a frameworkless
 * DOM chunk to mount directly. Both come from one walk, so exposing both is
 * cheap; a consumer takes whichever it needs.
 */
export interface RecipeModel {
    // The recipe title (the `# ...` heading), or '' when the source has none.
    title: string;
    // The recipe description (the header prose after the title), or ''
    description: string;
    // Recipe-level metadata: slug, scaling, and anything the model adds later.
    meta: RecipeMeta;
    // The render structure: part-tagged nodes for a binding to render as components.
    structure: StructureNode;
    // The built element tree: a serialisable DOM chunk the consumer mounts directly.
    root: ElementNode;
}

/**
 * Parse a recipe `.md` source into the public {@link RecipeModel}: extract the
 * frontmatter + body, compile the body to the DAG, walk it to render structure,
 * and build the element tree.
 */
export function parse(md: string): RecipeModel {
    const { title, description, blocks, meta } = extractRecipe(md);
    const recipe = compile(parseGrammar(blocks[0]), meta);
    const structure = walkRecipe(recipe);
    const root = build(structure);
    return {
        title: title ?? '',
        description: description ?? '',
        meta,
        structure,
        root,
    };
}
