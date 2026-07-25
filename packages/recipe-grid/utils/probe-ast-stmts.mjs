// Dump each top-level stmt's shape from the AST: its expr kind, and crucially
// its `outputs` and `named` fields. This tells us whether a bare ingredient
// line ("2 tsp ground cumin") carries a name in the AST or not.
import { readFileSync } from 'node:fs';
const PKG = new URL('..', import.meta.url).pathname;
const { parse } = await import(`${PKG}/src/generated/grammar.generated.js`);
const { extractRecipe } = await import(`${PKG}/src/markdown.ts`);
const md = readFileSync(`${PKG}/../../apps/site/src/content/recipes/turkish-pizza.md`, 'utf8');
const { blocks } = extractRecipe(md);
const ast = parse(blocks[0]);

function nameOf(o){
  if(o===null) return 'null';
  return '[' + o.map(s => s.substrings.map(ss=>ss.string ?? `{${JSON.stringify(ss.number)}}`).join('')).join(', ') + ']';
}
function exprLabel(e){
  if(e.kind==='reference') return `reference name="${e.name.substrings.map(s=>s.string??'').join('')}"`;
  if(e.kind==='step') return `step name="${e.name.substrings.map(s=>s.string??'').join('')}"`;
  return e.kind;
}

ast.stmts.forEach((s,i)=>{
  console.log(`stmt[${i}] expr=${exprLabel(s.expr)}  outputs=${nameOf(s.outputs)}  named=${s.named}`);
});
