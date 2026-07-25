// Independently extract (a) all text/quantity the DAG holds, and (b) all
// text/quantity the walk output carries, then diff. A mismatch means walk
// dropped or altered content. Read-only; writes nothing to the project.
import { readFileSync } from 'node:fs';
const PKG = new URL('..', import.meta.url).pathname;
const { parse } = await import(`${PKG}/src/generated/grammar.generated.js`);
const { extractRecipe } = await import(`${PKG}/src/markdown.ts`);
const { compile } = await import(`${PKG}/src/compiler.ts`);
const { walk } = await import(`${PKG}/src/structure/walk.ts`);

const md = readFileSync(`${PKG}/../../apps/site/src/content/recipes/turkish-pizza.md`, 'utf8');
const { blocks } = extractRecipe(md);
const recipe = compile(parse(blocks[0]));

function svs(s){ return Array.isArray(s)?s.map(p=>typeof p==='string'?p:`{${JSON.stringify(p)}}`).join(''):'<none>'; }
function qty(q){ return q?`${JSON.stringify(q.value)}|${q.unit??''}|${q.valueUnitSpacing}|${q.preposition}`:'<none>'; }

// (a) Walk the raw DAG, in the SAME traversal order walk() produces, listing the
// text/quantity each node type carries per the model.
function dagContent(node, out){
  switch(node.kind){
    case 'ingredient':
      out.push(`ingredient text=[${svs(node.description)}] qty=[${qty(node.quantity)}]`);
      break;
    case 'step':
      out.push(`step text=[${svs(node.description)}]`);
      node.inputs.forEach(i=>dagContent(i,out));
      break;
    case 'reference':
      out.push(`reference qty=[${qty(node.amount??null)}]`);
      break;
    case 'subRecipe':
      out.push(`subRecipe hasHeading=${node.hasHeading} name=[${svs(node.outputNames[0])}]`);
      dagContent(node.subTree,out);
      break;
    case 'recipeReference':
      out.push(`recipeReference`);
      break;
  }
}

// (b) Walk the StructureNode tree, listing the content each node carries.
function walkContent(sn, out){
  const c=sn.content;
  const t = c && c.text!==undefined ? svs(c.text) : '<none>';
  const q = c && c.quantity!==undefined ? qty(c.quantity) : '<none>';
  // Label by the part marker's trailing name.
  const partName = sn.part.replace('data-recipe-grid-','');
  out.push(`${partName} text=[${t}] qty=[${q}]`);
  sn.children.forEach(x=>walkContent(x,out));
}

let mism=0;
recipe.recipeTrees.forEach((tree,i)=>{
  const dag=[]; dagContent(tree,dag);
  const wlk=[]; walkContent(walk(tree),wlk);
  // Print side by side per tree.
  console.log(`\n===== tree[${i}] =====`);
  const n=Math.max(dag.length,wlk.length);
  for(let k=0;k<n;k++){
    const d=dag[k]??'<missing>';
    const w=wlk[k]??'<missing>';
    console.log(`  DAG : ${d}`);
    console.log(`  WALK: ${w}`);
    console.log('');
  }
});
