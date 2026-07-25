// Faithful dump of the structure walkRecipe() produces for the -svelte test
// fixture. NOT a reconstruction: it serializes the actual walked object as-is
// (every field present, nothing invented, nothing dropped), so it is the real
// baseline for -svelte binding comparison. The walked structure is a tree (the
// walk resolves the DAG into render structure), so a plain stringify is enough;
// if it ever threw on a cycle, that would itself be the bug. Read-only; writes
// nothing to the project.
import { readFileSync } from 'node:fs';

const PKG = new URL('..', import.meta.url).pathname;
const { parse } = await import(`${PKG}/src/generated/grammar.generated.js`);
const { extractRecipe } = await import(`${PKG}/src/markdown.ts`);
const { compile } = await import(`${PKG}/src/compiler.ts`);
const { walkRecipe } = await import(`${PKG}/src/structure/walk.ts`);

const md = readFileSync(`${PKG}/../recipe-grid-svelte/tests/fixtures/turkish-pizza.md`, 'utf8');
const { blocks, meta } = extractRecipe(md);
const recipe = compile(parse(blocks[0]), meta);

const structure = walkRecipe(recipe);

console.log(JSON.stringify(structure, null, 2));
