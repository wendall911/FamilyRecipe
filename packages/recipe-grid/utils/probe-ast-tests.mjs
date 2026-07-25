// Dump the raw AST the parser produces for the -svelte test fixture, so we can
// see the shape of what parsed (before the compiler builds the DAG). Uses stock
// parse + extractRecipe only; no reconstruction. Read-only; writes nothing to
// the project.
import { readFileSync } from 'node:fs';

const PKG = new URL('..', import.meta.url).pathname;
const { parse } = await import(`${PKG}/src/generated/grammar.generated.js`);
const { extractRecipe } = await import(`${PKG}/src/markdown.ts`);

const md = readFileSync(`${PKG}/../recipe-grid-svelte/tests/fixtures/turkish-pizza.md`, 'utf8');
const { blocks } = extractRecipe(md);
const ast = parse(blocks[0]);

console.log(JSON.stringify(ast, null, 2));
