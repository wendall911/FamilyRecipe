import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parse } from '../src/generated/grammar.generated.js';
import { findAll } from './helpers.ts';

interface QuantityNode {
    kind: 'quantity';
    value: unknown;
    unit: { substrings: { string: string }[] } | null;
    valueUnitSpacing: string;
    preposition: string;
}

function quantityOf(src: string): QuantityNode {
    const quantities = findAll(parse(src), (o) => o.kind === 'quantity');
    assert.ok(quantities.length >= 1, `expected a quantity node in: ${JSON.stringify(src)}`);
    return quantities[0] as unknown as QuantityNode;
}

const unitText = (q: QuantityNode): string | null =>
    q.unit ? q.unit.substrings.map((s) => s.string).join('') : null;

test('integer value with unit and preposition', () => {
    const q = quantityOf('6 tsp of cocoa powder\n');
    assert.deepEqual(q.value, 6);
    assert.equal(unitText(q), 'tsp');
    assert.equal(q.valueUnitSpacing, ' ');
    assert.equal(q.preposition, ' of');
});

test('value directly abutting unit has empty spacing', () => {
    const q = quantityOf('200g of chocolate\n');
    assert.deepEqual(q.value, 200);
    assert.equal(unitText(q), 'g');
    assert.equal(q.valueUnitSpacing, '');
    assert.equal(q.preposition, ' of');
});

test('fraction value flows through into the quantity', () => {
    const q = quantityOf('1/2 cup of butter\n');
    assert.deepEqual(q.value, { numerator: 1, denominator: 2 });
    assert.equal(unitText(q), 'cup');
});

test('unit-less count: a non-unit word is not treated as a unit', () => {
    const q = quantityOf('2 large eggs\n');
    assert.deepEqual(q.value, 2);
    assert.equal(unitText(q), null);
    assert.equal(q.valueUnitSpacing, '');
    assert.equal(q.preposition, '');
});
