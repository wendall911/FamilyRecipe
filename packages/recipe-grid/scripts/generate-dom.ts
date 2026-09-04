import { parse } from '../src/index.ts'
import { readFileSync } from 'node:fs'
import type { ElementNode } from '../src/index.ts';

const arg = process.argv[2];

if (!arg && process.stdin.isTTY) {
    process.exit(0);
}

const raw = readFileSync(arg ?? 0, 'utf-8');
const recipeModel = parse(raw);

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function serialize(node: ElementNode): string {
    if (!node.tag) {
        return escapeHtml(node.text ?? '');
    }

    const attrs = Object.entries(node.attrs)
        .map(([k, v]) => ` ${k}="${escapeHtml(v)}"`)
        .join('');
    const inner = node.children.map(serialize).join('');

    return `<${node.tag}${attrs}>${inner}</${node.tag}>`;
}

process.stdout.write(serialize(recipeModel.root));
