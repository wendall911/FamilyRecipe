const PKG = new URL('..', import.meta.url).pathname;
const { parse } = await import(`${PKG}/src/generated/grammar.generated.js`);
const { extractRecipe } = await import(`${PKG}/src/markdown.ts`);
const { compile } = await import(`${PKG}/src/compiler.ts`);
const { walkRecipe } = await import(`${PKG}/src/structure/walk.ts`);
const { build } = await import(`${PKG}/src/structure/build.ts`);
const { readFileSync } = await import('node:fs');

const md = readFileSync(`${PKG}/../../apps/site/src/content/recipes/turkish-pizza.md`,'utf8');
const { blocks, meta } = extractRecipe(md);
const recipe = compile(parse(blocks[0]), meta);
try {
  const el = build(walkRecipe(recipe));
  // tag census + count text nodes carrying content
  const census = {}; let textNodes = 0;
  (function c(n){ census[n.tag]=(census[n.tag]||0)+1; if(n.text!==undefined) textNodes++; n.children?.forEach(c); })(el);
  console.log('build() OK. root tag =', el.tag);
  console.log('tag census =', JSON.stringify(census));
  console.log('text-bearing nodes =', textNodes);
} catch(e){ console.log('!!! build THREW:', e.message); }
