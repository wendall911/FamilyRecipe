// Dump the StructureNode tree the second extract pass produces, so the element
// tree can be read as nesting rather than traced through code.
// Dump utility only; writes nothing to the project.
//
//   node utils/probe-extract-structure.mjs [path-to-recipe.md]
//
// Defaults to turkish-pizza. A path is resolved relative to the working
// directory.
//
// The indented tree is the DOM: what nests inside what, in what order, with the
// tag it renders as and the attributes it carries. Read the part markers as the
// styling handles and the data-* as what the node knows about itself.
import { readFileSync } from 'node:fs';

const PKG = new URL('..', import.meta.url).pathname;
const { parse } = await import(`${PKG}/src/generated/grammar.generated.js`);
const { extractRecipe } = await import(`${PKG}/src/markdown.ts`);
const { compile } = await import(`${PKG}/src/compiler.ts`);
const { extractShape } = await import(`${PKG}/src/structure/extract-shape.ts`);
const { extractStructure } = await import(
    `${PKG}/src/structure/extract-structure.ts`
);

const target =
    process.argv[2] ?? `${PKG}/../../apps/site/src/content/recipes/turkish-pizza.md`;
const md = readFileSync(target, 'utf8');
const { blocks, meta } = extractRecipe(md);
const recipe = compile(parse(blocks[0]), meta);
const structure = extractStructure(extractShape(recipe));

// Attribute names shorn of the data-recipe-grid- prefix, so a line is readable.
function shortAttr(name) {
    return name.replace('data-recipe-grid-', '');
}

// A node's attributes on one line: the part marker first, then the rest.
function attrs(node) {
    const marker = node.part !== undefined ? `[${shortAttr(node.part)}]` : '';
    const data = Object.entries(node.dataAttrs)
        .map(([k, v]) => `${shortAttr(k)}=${v}`)
        .join(' ');
    const semantic = Object.entries(node.attrs ?? {})
        .map(([k, v]) => `${k}="${v}"`)
        .join(' ');

    return [marker, data, semantic].filter((s) => s !== '').join(' ');
}

let count = 0;

function show(node, depth) {
    count += 1;

    const pad = '  '.repeat(depth);
    const text = node.text !== undefined ? ` "${node.text}"` : '';

    console.log(`${pad}<${node.tag}> ${attrs(node)}${text}`);

    for (const child of node.children) show(child, depth + 1);
}

console.log(`recipe: ${target.split('/').pop()}\n`);
show(structure, 0);
console.log(`\n${count} nodes`);
