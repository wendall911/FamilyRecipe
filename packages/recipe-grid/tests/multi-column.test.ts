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
interface StepNode {
    kind: 'step';
    name: { substrings: StringPart[] };
    inputs: unknown[];
}
interface ReferenceNode {
    kind: 'reference';
    name: { substrings: StringPart[] };
    amount: unknown;
}

// Render an interpolated value: integers/decimals as-is, exact fractions
// ({numerator, denominator}) as a mixed number, e.g. {3,2} -> "1 1/2", {3,4} -> "3/4".
const renderNumber = (n: unknown): string => {
    if (n !== null && typeof n === 'object' && 'numerator' in n && 'denominator' in n) {
        const { numerator, denominator } = n as { numerator: number; denominator: number };
        const whole = Math.trunc(numerator / denominator);
        const rem = numerator % denominator;
        if (whole !== 0 && rem !== 0) return `${whole} ${rem}/${denominator}`;
        if (whole !== 0) return String(whole);
        return `${rem}/${denominator}`;
    }
    return String(n);
};

const svs = (parts: StringPart[]): string =>
    parts
        .map((p) => (p.kind === 'interpolatedValue' ? renderNumber(p.number) : (p.string ?? '')))
        .join('');

// The single recipe tree of the multi-column-table fixture (rasin-bread.md).
function tableRoot(): StepNode {
    const { blocks } = extractRecipe(fixture('rasin-bread.md'));
    const recipe = parse(blocks[0]) as { stmts: { expr: StepNode }[] };
    assert.equal(recipe.stmts.length, 1, 'expected a single recipe statement');
    return recipe.stmts[0].expr;
}

test('multi-column table: an outer step wraps a sub-table plus a standalone row', () => {
    const outer = tableRoot();
    assert.equal(outer.kind, 'step');
    assert.equal(svs(outer.name.substrings), 'Add when beeper sounds');
    assert.equal(outer.inputs.length, 2);
});

test('multi-column table: a quoted step name keeps its parentheses', () => {
    const sub = tableRoot().inputs[0] as StepNode;
    assert.equal(sub.kind, 'step');
    assert.equal(svs(sub.name.substrings), 'Programme 1 (Basic)');
});

test('multi-column table: the sub-table holds one node per data row', () => {
    const sub = tableRoot().inputs[0] as StepNode;
    assert.equal(sub.inputs.length, 9);
});

test('multi-column table: a row is a left-to-right chain of its column cells', () => {
    // First row: ({1 1/2} lb, {2} lb, Loaf size). ltr_shorthand nests it so the
    // first column is the base cell and each later column (and the label) wraps
    // it as a step -- the shape the grid lays out horizontally as one row.
    const row = (tableRoot().inputs[0] as StepNode).inputs[0] as StepNode;
    assert.equal(row.kind, 'step');
    assert.equal(svs(row.name.substrings), 'Loaf size');

    const secondColumn = row.inputs[0] as StepNode;
    assert.equal(secondColumn.kind, 'step');
    assert.equal(svs(secondColumn.name.substrings), '2 lb');

    const firstColumn = secondColumn.inputs[0] as ReferenceNode;
    assert.equal(firstColumn.kind, 'reference');
    assert.equal(svs(firstColumn.name.substrings), '1 1/2 lb');
});

test('multi-column table: a standalone row is a sibling of the sub-table, not nested in it', () => {
    // ({5/8} cup, {3/4} cup, Rasins) is the outer step's second input.
    const row = tableRoot().inputs[1] as StepNode;
    assert.equal(row.kind, 'step');
    assert.equal(svs(row.name.substrings), 'Rasins');

    const secondColumn = row.inputs[0] as StepNode;
    assert.equal(svs(secondColumn.name.substrings), '3/4 cup');

    const firstColumn = secondColumn.inputs[0] as ReferenceNode;
    assert.equal(firstColumn.kind, 'reference');
    assert.equal(svs(firstColumn.name.substrings), '5/8 cup');
});
