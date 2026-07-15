import { parse as parseGrammar } from '../generated/grammar.generated.js';
import { extractRecipe } from './markdown.ts';
import { compile } from './compiler.ts';

export interface RecipeModel {
    title: string;
    source: string;
}

export function parse(md: string): RecipeModel {
    const { title, blocks } = extractRecipe(md);
    // Placeholder surface: the compiled DAG has no layout yet, so it is
    // stringified for visibility. The real model/render seam comes later.
    const recipe = compile(parseGrammar(blocks[0]));
    return {
        title: title ?? '',
        source: JSON.stringify(recipe, null, 2),
    };
}

/**
 * Parse recipe source into the raw grammar parse tree.
 */
export function parseToTree(md: string): unknown {
    return parseGrammar(md);
}
