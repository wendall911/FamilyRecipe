import { parse } from '../../src/generated/grammar.generated.js';
import { extractRecipe } from '../../src/markdown.ts';
import { compile } from '../../src/compiler.ts';

import { fixture } from './ast-harness.ts';

/**
 * Compile a fixture to its DAG, the same path `index.ts` takes: extract the
 * frontmatter and body, parse the body, compile it with the meta. Returns
 * whatever `compile` returns -- the tests are what checks its shape.
 */
export function compileFixture(name: string) {
    const { blocks, meta } = extractRecipe(fixture(name));

    return compile(parse(blocks[0]), meta);
}
