// Dump the raw AST the parser produces for turkish-pizza, so we can see the
// shape of a sub-recipe as recipe-grid defines it (before the compiler builds
// the DAG). Read-only; writes nothing to the project.
import { readFileSync } from 'node:fs';

const PKG = new URL('..', import.meta.url).pathname;
const { parse } = await import(`${PKG}/src/generated/grammar.generated.js`);
const { extractRecipe } = await import(`${PKG}/src/markdown.ts`);

const md = readFileSync(`${PKG}/../../apps/site/src/content/recipes/turkish-pizza.md`, 'utf8');
const { blocks } = extractRecipe(md);
const ast = parse(blocks[0]);

console.log(JSON.stringify(ast, null, 2));
