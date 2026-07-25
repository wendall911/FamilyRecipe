const PKG = new URL('..', import.meta.url).pathname;
const { parse } = await import(`${PKG}/src/generated/grammar.generated.js`);
const { extractRecipe } = await import(`${PKG}/src/markdown.ts`);
const { compile } = await import(`${PKG}/src/compiler.ts`);
const { walkRecipe } = await import(`${PKG}/src/structure/walk.ts`);
const { build } = await import(`${PKG}/src/structure/build.ts`);
const { readFileSync } = await import('node:fs');

const md = readFileSync(`${PKG}/../../apps/site/src/content/recipes/turkish-pizza.md`,'utf8');
const { title, blocks, meta } = extractRecipe(md);
const el = build(walkRecipe(compile(parse(blocks[0]), meta)));

function esc(s){ return String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function html(n){
  const attrs = Object.entries(n.attrs).map(([k,v])=> v===''?` ${k}`:` ${k}="${esc(v)}"`).join('');
  const inner = (n.text!==undefined?esc(n.text):'') + n.children.map(html).join('');
  return `<${n.tag}${attrs}>${inner}</${n.tag}>`;
}
const css = readFileSync(`${PKG}/src/styles/recipe-grid.css`,'utf8');
process.stdout.write(
`<!doctype html><meta charset=utf-8><title>${esc(title)} — headless layout only</title>
<style>
/* headless layout CSS (the deliverable) */
${css}
/* MINIMAL visibility hints so we can SEE the layout-only structure — NOT part of the deliverable */
[data-recipe-grid-step],[data-recipe-grid-inputs],[data-recipe-grid-ingredient],[data-recipe-grid-reference],[data-recipe-grid-sub-recipe]{outline:1px solid rgba(0,0,0,.25)}
[data-recipe-grid-step]>p,[data-recipe-grid-sub-recipe-header]{background:rgba(0,0,0,.06);padding:4px 8px}
[data-recipe-grid-ingredient],[data-recipe-grid-reference]{padding:4px 8px}
[data-recipe-grid-reference]{background:rgba(30,90,200,.08)}
body{font:13px/1.3 system-ui,sans-serif;margin:20px}
</style>
<h1>${esc(title)}</h1>
<p style="color:#666">Real pipeline element tree · headless layout CSS only · thin outlines are visibility hints, not the deliverable.</p>
${html(el)}
`);
