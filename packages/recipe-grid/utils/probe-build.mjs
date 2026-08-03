// Dump the ElementNode tree `build()` produces from the render structure, so
// the transported tree can be read as nesting rather than traced through code.
// Dump utility only; writes nothing to the project.
//
//   node utils/probe-build.mjs [path-to-recipe.md]
//
// Defaults to turkish-pizza. A path is resolved relative to the working
// directory.
//
// build() is a pure transport: every element here should be the same element
// probe-extract-structure.mjs shows, with the part marker flattened into the
// attribute list. Read the two side by side.
import { readFileSync } from 'node:fs';

const PKG = new URL('..', import.meta.url).pathname;
const { parse } = await import(`${PKG}/src/generated/grammar.generated.js`);
const { extractRecipe } = await import(`${PKG}/src/markdown.ts`);
const { compile } = await import(`${PKG}/src/compiler.ts`);
const { extractShape } = await import(`${PKG}/src/structure/extract-shape.ts`);
const { extractStructure } = await import(
    `${PKG}/src/structure/extract-structure.ts`
);
const { build } = await import(`${PKG}/src/structure/build.ts`);

const target =
    process.argv[2] ?? `${PKG}/../../apps/site/src/content/recipes/turkish-pizza.md`;
const md = readFileSync(target, 'utf8');
const { blocks, meta } = extractRecipe(md);
const recipe = compile(parse(blocks[0]), meta);
const element = build(extractStructure(extractShape(recipe), meta));

// Attribute names shorn of the data-recipe-grid- prefix, so a line is readable.
function shortAttr(name) {
    return name.replace('data-recipe-grid-', '');
}

// A node's attributes on one line. The part marker arrives as a valueless
// data-* key, so it prints as a bare name. Every other value goes through
// JSON.stringify -- the same call that wrote it -- so the value's boundaries
// are never in doubt, including a value that carries quotes of its own.
function attrs(node) {
    return Object.entries(node.attrs)
        .map(([k, v]) =>
            v === '' ? `[${shortAttr(k)}]` : `${shortAttr(k)}=${JSON.stringify(v)}`,
        )
        .join(' ');
}

function show(node, depth) {
    const pad = '  '.repeat(depth);
    const text = node.text !== undefined ? ` "${node.text}"` : '';

    console.log(`${pad}<${node.tag}> ${attrs(node)}${text}`);

    for (const child of node.children) show(child, depth + 1);
}

console.log(`recipe: ${target.split('/').pop()}\n`);
show(element, 0);
