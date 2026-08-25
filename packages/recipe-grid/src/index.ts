import { parse as parseGrammar } from './generated/grammar.generated.js';
import { extractRecipe, type RecipeMeta } from './markdown.ts';
import { compile } from './compiler.ts';
import { extractShape } from './structure/extract-shape.ts';
import {
    extractStructure,
    type StructureNode,
} from './structure/extract-structure.ts';
import { build, type ElementNode } from './structure/build.ts';

/*
 * Re-export the public vocabulary so a binding author (or any consumer) has the
 * whole surface from one entry point.
 */
export type { RecipeMeta } from './markdown.ts';
export type { StructureNode } from './structure/extract-structure.ts';
export type { ElementNode } from './structure/build.ts';

/**
 * Thrown when a recipe `.md` does not compile to a card. The originating error
 * rides on `cause` for debugging.
 */
export class RecipeParseError extends Error {
    constructor(message: string, options?: { cause?: unknown }) {
        super(message, options);
        this.name = 'RecipeParseError';
    }
}

/**
 * The public result of parsing a recipe: its title, its recipe-level metadata,
 * and both render trees. `structure` is the framework-neutral render structure a
 * binding maps to components; `root` is that same structure transported to a
 * built element tree, a frameworkless DOM chunk to mount directly. Both come
 * from one pass, so exposing both is cheap; a consumer takes whichever it needs.
 */
export interface RecipeModel {
    title: string;
    description: string;
    meta: RecipeMeta;
    structure: StructureNode;
    root: ElementNode;
}

/**
 * Parse a recipe `.md` source into the public {@link RecipeModel}
 */
export function parse(md: string): RecipeModel {
    try {
        const { title, description, blocks, meta } = extractRecipe(md);
        const recipe = compile(parseGrammar(blocks[0]), meta);
        const structure = extractStructure(extractShape(recipe), meta);
        const root = build(structure);

        return {
            title: title ?? '',
            description: description ?? '',
            meta,
            structure,
            root,
        };
    }
    catch (err) {
        throw new RecipeParseError('recipe body is not parseable', {
            cause: err,
        });
    }
}
