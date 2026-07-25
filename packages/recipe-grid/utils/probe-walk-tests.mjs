const PKG = new URL('..', import.meta.url).pathname;
const { parse } = await import(`${PKG}/src/generated/grammar.generated.js`);
const { extractRecipe } = await import(`${PKG}/src/markdown.ts`);
const { compile } = await import(`${PKG}/src/compiler.ts`);
const { walkRecipe } = await import(`${PKG}/src/structure/walk.ts`);
const { readFileSync } = await import('node:fs');

const md = readFileSync(`${PKG}/../recipe-grid-svelte/tests/fixtures/turkish-pizza.md`,'utf8');
const { blocks, meta } = extractRecipe(md);
const recipe = compile(parse(blocks[0]), meta);

try {
  const struct = walkRecipe(recipe);
  // Full StructureNode tree, verbatim: exact field names, optionality, nesting.
  console.log(JSON.stringify(struct, null, 2));
} catch(e) {
  console.log('!!! walkRecipe THREW:', e.message);
  console.log(e.stack.split('\n').slice(0,4).join('\n'));
}
