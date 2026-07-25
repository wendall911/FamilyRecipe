const PKG = new URL('..', import.meta.url).pathname;
const { parse } = await import(`${PKG}/src/generated/grammar.generated.js`);
const { compile } = await import(`${PKG}/src/compiler.ts`);
const { walkRecipe } = await import(`${PKG}/src/structure/walk.ts`);
const { build } = await import(`${PKG}/src/structure/build.ts`);

// minimal: mix( 2 tsp honey, 200ml water )  → one step with two ingredient inputs
const recipe = compile(parse(['2 tsp honey','200ml water','mix(honey, water)'].join('\n')));
const el = build(walkRecipe(recipe));

// print the element tree compactly: tag + which data-recipe-grid-* part marker
function show(n, d=0){
  const part = Object.keys(n.attrs).find(k=>k.startsWith('data-recipe-grid-')) || '';
  const t = n.text!==undefined ? ` "${n.text}"` : '';
  console.log('  '.repeat(d) + `<${n.tag}${part?` ${part}`:''}>` + t);
  n.children.forEach(c=>show(c,d+1));
}
// dig to the step (skip root/grid wrappers)
show(el);
