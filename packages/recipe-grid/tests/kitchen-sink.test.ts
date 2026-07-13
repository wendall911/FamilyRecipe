import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { parse } from '../generated/grammar.generated.js';
import { extractRecipe } from '../src/markdown.ts';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string): string =>
    readFileSync(join(here, 'fixtures', name), 'utf8');

interface StringPart {
    kind: 'substring' | 'interpolatedValue';
    string?: string;
    number?: unknown;
}
interface ReferenceNode {
    kind: 'reference';
    name: { substrings: StringPart[] };
    amount: unknown;
}

// The contrived kitchen-sink fixture packs awkward-but-real constructs so tests
// pin down how each is handled. It is not a real recipe.
function referencesOf(name: string): ReferenceNode[] {
    const { blocks } = extractRecipe(fixture(name));
    const out: ReferenceNode[] = [];
    (function walk(node: unknown): void {
        if (node && typeof node === 'object') {
            if ((node as { kind?: string }).kind === 'reference') out.push(node as ReferenceNode);
            for (const v of Object.values(node)) {
                if (Array.isArray(v)) v.forEach(walk);
                else if (v && typeof v === 'object') walk(v);
            }
        }
    })(parse(blocks[0]));
    return out;
}

const nameText = (r: ReferenceNode): string =>
    r.name.substrings
        .map((p) => (p.kind === 'interpolatedValue' ? String(p.number) : (p.string ?? '')))
        .join('');

test('kitchen-sink: double-quoted names keep punctuation intact', () => {
    const refs = referencesOf('kitchen-sink.md');
    const flour = refs.find((r) => nameText(r).includes('plain flour'));
    assert.ok(flour, 'expected a plain flour reference');
    assert.equal(nameText(flour), 'plain flour (12% protein)');
});

test('kitchen-sink: single-quoted names keep commas and parens', () => {
    const refs = referencesOf('kitchen-sink.md');
    const veg = refs.find((r) => nameText(r).includes('mixed veg'));
    assert.ok(veg, 'expected a mixed veg reference');
    assert.equal(nameText(veg), 'mixed veg (e.g. carrots, peas)');
});

test('kitchen-sink: {N} is an interpolated (scalable) value inside the name, not an amount', () => {
    const refs = referencesOf('kitchen-sink.md');
    const parsley = refs.find((r) => nameText(r).includes('parsley'));
    assert.ok(parsley, 'expected a parsley reference');
    // The {1} became a scalable interpolated value embedded in the name.
    const interp = parsley.name.substrings.find((p) => p.kind === 'interpolatedValue');
    assert.ok(interp, 'expected an interpolated value in the parsley name');
    assert.deepEqual(interp.number, 1);
    // The braces did not produce a reference amount.
    assert.equal(parsley.amount, null);
    assert.equal(nameText(parsley), '1 handful fresh parsley');
});
