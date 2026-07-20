import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parse } from '../src/generated/grammar.generated.js';
import { findAll } from './helpers.ts';

/**
 * The value of the first quantity in a parsed source. Numbers are absorbed into
 * the containing quantity, so the quantity's `value` is where a parsed number
 * surfaces in real recipe input.
 */
function quantityValue(src: string): unknown {
    const quantities = findAll(parse(src), (o) => o.kind === 'quantity');
    assert.ok(quantities.length >= 1, `expected a quantity node in: ${JSON.stringify(src)}`);
    return quantities[0].value;
}

test('decimal integer', () => {
    assert.deepEqual(quantityValue('200g of chocolate\n'), 200);
});

test('simple fraction 1/2', () => {
    assert.deepEqual(quantityValue('1/2 cup of butter\n'), { numerator: 1, denominator: 2 });
});

test('simple fraction 1/4 (irreducible, distinct value)', () => {
    assert.deepEqual(quantityValue('1/4 tsp of salt\n'), { numerator: 1, denominator: 4 });
});

test('mixed number 3 1/2 folds to 7/2', () => {
    assert.deepEqual(quantityValue('3 1/2 cups of flour\n'), { numerator: 7, denominator: 2 });
});
