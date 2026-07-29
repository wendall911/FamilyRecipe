import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parse } from '../src/generated/grammar.generated.js';
import { findAll } from './helpers.ts';

interface StringNode {
    substrings: { string: string }[];
}
interface StmtNode {
    kind: 'stmt';
    expr: { kind: string; label?: StringNode };
    outputs: StringNode[] | null;
    named: boolean;
}

const stringText = (s: StringNode | undefined): string | null =>
    s === undefined ? null : s.substrings.map((x) => x.string).join('');

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

// `=` is an ingredient label, not a sub-recipe output: it rides on the
// statement's node as `expr.label`, leaves `outputs` null, and is not named.
test('single output with "=": label on the node, not a named output', () => {
    const s = stmt('sauce = boil(tomatoes)\n');
    assert.equal(s.outputs, null);
    assert.equal(s.named, false);
    assert.equal(stringText(s.expr.label), 'sauce');
});

// `:=` is a sub-recipe heading: it produces a named output and marks the
// statement named. The label field is not used for `:=`.
test('single output with ":=": named', () => {
    const s = stmt('sauce := boil(tomatoes)\n');
    assert.deepEqual(outputNames(s), ['sauce']);
    assert.equal(s.named, true);
});
