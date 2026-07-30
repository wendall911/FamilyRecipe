import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { parse } from '../../src/generated/grammar.generated.js';
import { extractRecipe } from '../../src/markdown.ts';
import type { Recipe } from '../../src/ast.ts';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Read a fixture from `tests/fixtures` by file name.
 */
export const fixture = (name: string): string =>
    readFileSync(join(here, '../fixtures', name), 'utf8');

/**
 * Parse a fixture's first block.
 */
export function parseFixture(name: string): Recipe {
    const { blocks } = extractRecipe(fixture(name));

    return parse(blocks[0]) as Recipe;
}
