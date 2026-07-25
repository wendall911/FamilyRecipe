// Probe: what does the AST look like for a multi-output ":=" heading, and how
// does the compiler currently handle it? Read-only; writes nothing to project.
const PKG = new URL('..', import.meta.url).pathname;
const { parse } = await import(`${PKG}/src/generated/grammar.generated.js`);
const { compile } = await import(`${PKG}/src/compiler.ts`);

// A minimal recipe: two ingredients, then a multi-output ":=" heading, then a
// step that references one of the names.
const src = [
  '2 tsp honey',
  '200ml water',
  'foo, bar, baz := mix(honey, water)',
  'bake(foo)',
].join('\n');

console.log('=== SOURCE ===');
console.log(src);

const ast = parse(src);
console.log('\n=== AST (the multi-output stmt only) ===');
const multi = ast.stmts.find((s) => s.named);
console.log(JSON.stringify(multi, null, 2));

console.log('\n=== COMPILED (whole recipe, cycle-safe) ===');
const seen = new WeakSet();
const recipe = compile(ast);
console.log(JSON.stringify(recipe, (k, v) => {
  if (typeof v === 'object' && v !== null) {
    if (seen.has(v)) return '<<circular>>';
    seen.add(v);
  }
  return v;
}, 2));
