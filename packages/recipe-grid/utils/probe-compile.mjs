// Compile a fixture through the real parser + new compiler and print the DAG,
// so it can be checked against the rendered table. Read-only; writes nothing.
import { readFileSync } from 'node:fs';

const PKG = new URL('..', import.meta.url).pathname;
const { parse } = await import(`${PKG}/src/generated/grammar.generated.js`);
const { extractRecipe } = await import(`${PKG}/src/markdown.ts`);
const { compile } = await import(`${PKG}/src/compiler.ts`);

// Concise DAG printer: nesting + kind + the salient field.
function show(node, depth = 0) {
  const pad = '  '.repeat(depth);
  if (node == null) return `${pad}<null>`;
  switch (node.kind) {
    case 'ingredient': {
      const q = node.quantity
        ? ` [${JSON.stringify(node.quantity.value)}${node.quantity.unit ?? ''}]`
        : '';
      return `${pad}ingredient: ${svs(node.description)}${q}`;
    }
    case 'step':
      return [
        `${pad}step: ${svs(node.description)}`,
        ...node.inputs.map((i) => show(i, depth + 1)),
      ].join('\n');
    case 'subRecipe':
      return [
        `${pad}subRecipe [${node.outputNames.map(svs).join(', ')}] heading=${node.hasHeading}`,
        show(node.subTree, depth + 1),
      ].join('\n');
    case 'reference': {
      const a = node.amount == null ? 'all'
        : node.amount.kind === 'remainder' ? `remainder(${node.amount.wording})`
        : `${JSON.stringify(node.amount.value)}${node.amount.unit ?? ''}`;
      return `${pad}reference -> [${node.subRecipe.outputNames.map(svs).join(', ')}]#${node.outputIndex} amount=${a}`;
    }
    default:
      return `${pad}${node.kind}`;
  }
}
function svs(s) {
  return Array.isArray(s) ? s.map((p) => (typeof p === 'string' ? p : `{${JSON.stringify(p)}}`)).join('') : String(s);
}

// Whole-DAG dump: the ENTIRE compiled recipe as raw JSON, no field filtering,
// so every field (label, identity, quantity, …) is present to check against the
// rendered table. Spot-checking is invalid — dump it all, every time.
// `reference` nodes point back at their SubRecipe object (a cycle via the DAG),
// so use a seen-set replacer to render a back-reference marker instead of
// throwing on the circular structure.
function dumpRecipe(recipe) {
  const seen = new WeakSet();
  return JSON.stringify(
    recipe,
    (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) return '<<circular: already emitted above>>';
        seen.add(value);
      }
      return value;
    },
    2,
  );
}

for (const name of ['turkish-pizza']) {
  const md = readFileSync(`${PKG}/../../apps/site/src/content/recipes/${name}.md`, 'utf8');
  const { blocks, meta, title } = extractRecipe(md);
  console.log(`\n========== ${name}  (title=${JSON.stringify(title)} meta=${JSON.stringify(meta)}) ==========`);
  const ast = parse(blocks[0]);
  const recipe = compile(ast, meta);
  console.log(dumpRecipe(recipe));
}
