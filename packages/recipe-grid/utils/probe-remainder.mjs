const PKG = new URL('..', import.meta.url).pathname;
const { parse } = await import(`${PKG}/src/generated/grammar.generated.js`);
const { compile } = await import(`${PKG}/src/compiler.ts`);

const src = ['200g butter','mix(remaining butter)'].join('\n');
console.log('SRC:', JSON.stringify(src));

const ast = parse(src);
// Find the reference node in the AST for "remaining butter"
const mix = ast.stmts[1].expr;               // step: mix
const arg = mix.inputs[0];                    // reference: remaining butter
console.log('\n--- AST reference node (the "remaining butter" arg) ---');
console.log(JSON.stringify(arg, null, 1));

const recipe = compile(ast);
const bareIng = recipe.recipeTrees[1].inputs[0]; // compiled "butter"
console.log('\n--- Compiled node for that arg ---');
console.log(JSON.stringify(bareIng, null, 1));
