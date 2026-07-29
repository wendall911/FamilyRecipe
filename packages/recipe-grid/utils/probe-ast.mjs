/**
 * Dump the raw AST the parser produces, so a recipe's shape can be read as
 * recipe-grid defines it, before the compiler builds the DAG. Read-only;
 * writes nothing to the project.
 *
 *   node utils/probe-ast.mjs [path-to-recipe.md]
 *
 * Defaults to turkish-pizza. A path is resolved relative to the working
 * directory.
 */
import { readFileSync } from 'node:fs';

const PKG = new URL('..', import.meta.url).pathname;
const { parse } = await import(`${PKG}/src/generated/grammar.generated.js`);
const { extractRecipe } = await import(`${PKG}/src/markdown.ts`);

const target =
  process.argv[2] ?? `${PKG}/../../apps/site/src/content/recipes/turkish-pizza.md`;
const md = readFileSync(target, 'utf8');
const { blocks } = extractRecipe(md);
const ast = parse(blocks[0]);

console.log(JSON.stringify(ast, null, 2));
