// Dump the CardShape the first extract pass produces, so the card's shape can
// be read as nesting rather than traced through code.
// Dump utility only; writes nothing to the project.
//
//   node utils/probe-extract-shape.mjs [path-to-recipe.md]
//
// Defaults to turkish-pizza. A path is resolved relative to the working
// directory; the hot-hamburger and egg-fried-rice fixtures are Grid 2 recipes
// whose rendered tables are published, so their shapes can be read against a
// known-correct one.
//
// The card is flexbox, not a table — there are no coordinates to print. What
// there is to read is the nesting: what sits inside what, in what order, on
// which side. The indented tree is the card.
import { readFileSync } from 'node:fs';

const PKG = new URL('..', import.meta.url).pathname;
const { parse } = await import(`${PKG}/src/generated/grammar.generated.js`);
const { extractRecipe } = await import(`${PKG}/src/markdown.ts`);
const { compile } = await import(`${PKG}/src/compiler.ts`);
const { extractShape } = await import(`${PKG}/src/structure/extract-shape.ts`);

const target =
  process.argv[2] ?? `${PKG}/../../apps/site/src/content/recipes/turkish-pizza.md`;
const md = readFileSync(target, 'utf8');
const { blocks, meta } = extractRecipe(md);
const recipe = compile(parse(blocks[0]), meta);

const shape = extractShape(recipe);

// A short label for a node, so a line says what it is without dumping the node.
// Content is extract-structure.ts business; this is only for reading the dump by eye.
function label(node) {
  if (node === null) return '';
  const svs = (s) => (Array.isArray(s) ? s.map(String).join('') : String(s));
  switch (node.kind) {
    case 'ingredient':
      return `"${svs(node.description)}"`;
    case 'step':
      return `"${svs(node.description)}"`;
    case 'recipeReference':
      return `"${node.name}" -> ${node.targetSlug}`;
    case 'subRecipe':
      return `[${node.outputNames.map(svs).join(', ')}]`;
    default:
      return node.kind;
  }
}

console.log(`recipe: ${target.split('/').pop()}`);
console.log(
  `card: ${shape.boxes.length} boxes, ${shape.regions.length} regions ` +
    `(would be ${shape.extent.rows} x ${shape.extent.columns} as a table)`,
);

console.log('\n--- regions ---');
if (shape.regions.length === 0) {
  console.log('(none)');
} else {
  for (const r of shape.regions) {
    console.log(
      `${r.id}  box=${r.box} header=${r.header} body=${r.body}  ` +
        `within=${r.within.length ? r.within.join(',') : '-'}  ${label(r.subRecipe)}`,
    );
  }
}

/*
 * The box tree, indented. Read it as the card: a `row` lays its children out
 * left to right, a `column` top to bottom, a `leaf` is content. `side` says
 * what a box is to its parent. `touches` is what lies against it — `-` means
 * that edge is the parent's edge, which is what makes a border there the
 * boundary of the group.
 */
console.log('\n--- boxes ---');
function show(id, depth) {
  const box = shape.boxes[id];
  const pad = '  '.repeat(depth);
  const kind = box.node ? box.node.kind : 'group';
  const touch = `${box.touches.before ?? '-'}|${box.touches.after ?? '-'}`;
  const within = box.within.length ? ` within=${box.within.join(',')}` : '';
  console.log(
    `${String(id).padStart(3)} ${pad}${box.flow.padEnd(6)} ` +
      `${box.side.padEnd(6)} [${touch}] ${kind} ${label(box.node)}${within}`,
  );
  for (const child of box.children) show(child, depth + 1);
}
console.log('_id flow   side   [before|after] node');
show(shape.root, 0);
