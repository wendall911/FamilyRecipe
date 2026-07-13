import { parse as parseGrammar } from '../generated/grammar.generated.js';
import { extractRecipe } from './markdown.ts';

export interface RecipeModel {
    title: string;
    source: string;
}

export function parse(md: string): RecipeModel {
    const { title, blocks } = extractRecipe(md);
    const trees = blocks.map((block) => parseToTree(block));
    return {
        title: title ?? '',
        source: JSON.stringify(trees, null, 2),
    };
}

/**
 * Parse recipe source into the raw grammar parse tree.
 */
export function parseToTree(md: string): unknown {
    return parseGrammar(md);
}
