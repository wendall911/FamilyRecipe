const PKG = new URL('..', import.meta.url).pathname;
const { parse } = await import(`${PKG}/src/generated/grammar.generated.js`);
const { extractRecipe } = await import(`${PKG}/src/markdown.ts`);
const { compile } = await import(`${PKG}/src/compiler.ts`);
const { walkRecipe } = await import(`${PKG}/src/structure/walk.ts`);
const { readFileSync } = await import('node:fs');

const md = readFileSync(`${PKG}/../../apps/site/src/content/recipes/turkish-pizza.md`, 'utf8');
const { blocks, meta } = extractRecipe(md);
const recipe = compile(parse(blocks[0]), meta);

const structure = walkRecipe(recipe);

// Serialize a StructureNode to exact markup. Fields (from runtime):
//   tag        element name
//   part       full data-* attribute name (valueless), absent on some nodes
//   dataAttrs  { name: value } data-* attributes
//   attrs      { name: value } plain attributes
//   text       leaf text content
//   children   child StructureNodes
//   extent     layout metadata -> NOT markup, excluded
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = (s) => esc(s).replace(/"/g, '&quot;');

function serialize(node, depth = 0) {
  const pad = '  '.repeat(depth);
  const attrs = [];
  if (node.part) attrs.push(node.part);
  for (const [k, v] of Object.entries(node.dataAttrs ?? {})) attrs.push(`${k}="${escAttr(v)}"`);
  for (const [k, v] of Object.entries(node.attrs ?? {})) attrs.push(`${k}="${escAttr(v)}"`);
  const open = `<${node.tag}${attrs.length ? ' ' + attrs.join(' ') : ''}>`;

  const kids = node.children ?? [];
  const hasText = node.text !== undefined;
  if (!hasText && kids.length === 0) return `${pad}${open}</${node.tag}>`;

  const parts = [`${pad}${open}`];
  if (hasText) parts.push(`${pad}  ${esc(node.text)}`);
  for (const child of kids) parts.push(serialize(child, depth + 1));
  parts.push(`${pad}</${node.tag}>`);
  return parts.join('\n');
}

console.log(serialize(structure));
