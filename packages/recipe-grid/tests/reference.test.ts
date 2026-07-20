import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parse } from '../src/generated/grammar.generated.js';
import { findAll } from './helpers.ts';

interface StringNode {
    substrings: { string: string }[];
}
interface ReferenceNode {
    kind: 'reference';
    name: StringNode;
    amount: { kind: string; value?: unknown; unit?: StringNode | null } | null;
}

function referenceOf(src: string): ReferenceNode {
    const refs = findAll(parse(src), (o) => o.kind === 'reference');
    assert.ok(refs.length >= 1, `expected a reference node in: ${JSON.stringify(src)}`);
    return refs[0] as unknown as ReferenceNode;
}

const nameText = (r: ReferenceNode): string => r.name.substrings.map((s) => s.string).join('');
const unitText = (r: ReferenceNode): string | null =>
    r.amount && r.amount.unit
        ? r.amount.unit.substrings.map((s) => s.string).join('')
        : null;

test('reference with a quantity: the preposition belongs to the quantity, not the name', () => {
    const r = referenceOf('200g of chocolate\n');
    assert.equal(nameText(r), 'chocolate');
    assert.equal(r.amount?.kind, 'quantity');
    assert.deepEqual(r.amount?.value, 200);
    assert.equal(unitText(r), 'g');
});

test('bare ingredient: no quantity', () => {
    const r = referenceOf('chocolate\n');
    assert.equal(nameText(r), 'chocolate');
    assert.equal(r.amount, null);
});

test('unit-less count with a multi-word name', () => {
    const r = referenceOf('2 large eggs\n');
    assert.equal(nameText(r), 'large eggs');
    assert.equal(r.amount?.kind, 'quantity');
    assert.deepEqual(r.amount?.value, 2);
    assert.equal(unitText(r), null);
});
