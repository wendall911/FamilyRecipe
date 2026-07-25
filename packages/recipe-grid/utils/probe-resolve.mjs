const PKG = new URL('..', import.meta.url).pathname;
const { parse } = await import(`${PKG}/src/generated/grammar.generated.js`);
const { extractRecipe } = await import(`${PKG}/src/markdown.ts`);
const { compile } = await import(`${PKG}/src/compiler.ts`);
const { readFileSync } = await import('node:fs');

const md = readFileSync(`${PKG}/../../apps/site/src/content/recipes/turkish-pizza.md`,'utf8');
const { blocks } = extractRecipe(md);
const recipe = compile(parse(blocks[0]));

const svs = (s)=>Array.isArray(s)?s.map(p=>typeof p==='string'?p:`{${JSON.stringify(p)}}`).join(''):String(s);
function label(n){
  if(!n) return '<null>';
  if(n.kind==='ingredient') return `ingredient("${svs(n.description)}"${n.label?` label=${n.label}`:''}${n.quantity?` qty=${n.quantity.value}${n.quantity.unit||''}`:''})`;
  if(n.kind==='step') return `step("${svs(n.description)}"${n.label?` label=${n.label}`:''}, ${n.inputs.length} inputs)`;
  if(n.kind==='subRecipe') return `subRecipe[${n.outputNames.map(svs).join(',')}]`;
  if(n.kind==='reference') return `reference -> ${label(n.resolvedNode)}`;
  return n.kind;
}
// Walk and report every reference and what it resolves to.
const seen=new Set();
function walk(n, path){
  if(!n||typeof n!=='object') return;
  if(n.kind==='reference'){
    console.log(`REF @ ${path}: resolves to ${label(n.resolvedNode)}${n.outputIndex!==undefined?` outIdx=${n.outputIndex}`:''}${n.amount?` amount=${n.amount.kind}(${n.amount.wording||n.amount.value})`:''}`);
  }
  for(const [k,v] of Object.entries(n)){
    if(k==='resolvedNode') continue; // don't recurse into pointer targets
    if(Array.isArray(v)) v.forEach((c,i)=>walk(c,`${path}.${k}[${i}]`));
    else if(v&&typeof v==='object') walk(v,`${path}.${k}`);
  }
}
recipe.recipeTrees.forEach((t,i)=>walk(t,`tree[${i}]`));
