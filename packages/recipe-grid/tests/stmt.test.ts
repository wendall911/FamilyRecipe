import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parse } from '../generated/grammar.generated.js';
import { findAll } from './helpers.ts';

interface StringNode {
    substrings: { string: string }[];
}
interface StmtNode {
    kind: 'stmt';
    expr: { kind: string };
    outputs: StringNode[] | null;
    named: boolean;
}

function stmt(src: string): StmtNode {
    const stmts = findAll(parse(src), (o) => o.kind === 'stmt');
    assert.ok(stmts.length >= 1, `expected a stmt node in: ${JSON.stringify(src)}`);
    return stmts[0] as unknown as StmtNode;
}

const outputNames = (s: StmtNode): string[] | null =>
    s.outputs === null
        ? null
        : s.outputs.map((o) => o.substrings.map((x) => x.string).join(''));

// A bare ingredient line has no assignment target.
test('no-output stmt: outputs null, not named', () => {
    const s = stmt('200g of chocolate\n');
    assert.equal(s.expr.kind, 'reference');
    assert.equal(s.outputs, null);
    assert.equal(s.named, false);
});

// synthetic — no current recipe fixture uses the assignment/output form.
test('single output with "=": not named', () => {
    const s = stmt('sauce = boil(tomatoes)\n');
    assert.deepEqual(outputNames(s), ['sauce']);
    assert.equal(s.named, false);
});

// synthetic — no current recipe fixture uses the ":=" named form.
test('single output with ":=": named', () => {
    const s = stmt('sauce := boil(tomatoes)\n');
    assert.deepEqual(outputNames(s), ['sauce']);
    assert.equal(s.named, true);
});

// synthetic — no current recipe fixture uses the multi-output form.
test('multiple outputs fold into an ordered list', () => {
    const s = stmt('white sauce, roux = mix(a, b)\n');
    assert.deepEqual(outputNames(s), ['white sauce', 'roux']);
    assert.equal(s.named, false);
});
