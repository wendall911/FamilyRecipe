const PKG = new URL('..', import.meta.url).pathname;
const { parse } = await import(`${PKG}/src/generated/grammar.generated.js`);
const { extractRecipe } = await import(`${PKG}/src/markdown.ts`);
const { compile } = await import(`${PKG}/src/compiler.ts`);
const { walkRecipe } = await import(`${PKG}/src/structure/walk.ts`);
const { readFileSync } = await import('node:fs');

const md = readFileSync(`${PKG}/../../apps/site/src/content/recipes/turkish-pizza.md`,'utf8');
const { blocks } = extractRecipe(md);
const struct = walkRecipe(compile(parse(blocks[0])));

const svs = (t)=> t? t.map(p=>typeof p==='string'?p:`{${JSON.stringify(p)}}`).join('') : '';
function label(n){
  const p = n.part.replace('data-recipe-grid-','');
  const txt = n.content?.text ? ` "${svs(n.content.text)}"` : '';
  const qty = n.content?.quantity ? ` [qty ${n.content.quantity.value}${n.content.quantity.unit||''}]` : '';
  return `${p}${txt}${qty}`;
}
function tree(n, d=0){
  console.log('  '.repeat(d) + label(n));
  n.children.forEach(c=>tree(c,d+1));
}
try {
  // find the Topping subRecipe node and print its subtree
  const grid = struct.children[0];
  const topping = grid.children.find(c => c.children.some(g => g.content?.text && svs(g.content.text)==='Topping'));
  console.log('=== TOPPING subtree (references should now show full bodies) ===');
  tree(topping);
} catch(e){ console.log('THREW', e.message); }
