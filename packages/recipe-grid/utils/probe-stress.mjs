const PKG = new URL('..', import.meta.url).pathname;
const { parse } = await import(`${PKG}/src/generated/grammar.generated.js`);
const { compile } = await import(`${PKG}/src/compiler.ts`);

function run(label, src){
  console.log(`\n========== ${label} ==========`);
  console.log(src);
  try {
    const ast = parse(src);
    const recipe = compile(ast);
    const s = new WeakSet();
    console.log('--- DAG ---');
    console.log(JSON.stringify(recipe, (k,v)=>{ if(typeof v==='object'&&v!==null){ if(s.has(v)) return '<<circ>>'; s.add(v);} return v; }, 1));
  } catch (e) {
    console.log('!!! THREW:', e.message);
  }
}

run('1. label referenced later', ['flour = 200g "plain flour"','bake(flour)'].join('\n'));
run('2. remainder on ingredient', ['200g butter','mix(remaining butter)'].join('\n'));
run('3. step label referenced', ['peppers = 150g "red peppers", chopped','mix(peppers)'].join('\n'));
run('4. forward reference (backward-only: should NOT resolve)', ['bake(dough)','Dough := knead(200g flour)'].join('\n'));
run('5. label reused as ingredient name', ['salt = 1 tsp "sea salt"','mix(salt, 2 tsp salt)'].join('\n'));
run('6. duplicate := output names', ['2 tsp honey','A, A := mix(honey)','bake(A)'].join('\n'));
