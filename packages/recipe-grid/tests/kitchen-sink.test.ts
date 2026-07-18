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
interface StepNode {
    kind: 'step';
    name: { substrings: StringPart[] };
    inputs: unknown[];
}
interface StmtNode {
    kind: 'stmt';
    expr: unknown;
    outputs: { substrings: StringPart[] }[] | null;
    named: boolean;
}
interface QuantityNode {
    kind: 'quantity';
    value: unknown;
    unit: { substrings: StringPart[] } | null;
    valueUnitSpacing: string;
    preposition: string;
}
interface RemainderNode {
    kind: 'remainder';
    wording: string;
    preposition: string;
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

const substringsText = (parts: StringPart[]): string =>
    parts
        .map((p) => (p.kind === 'interpolatedValue' ? String(p.number) : (p.string ?? '')))
        .join('');

// Fetch the statement in a fixture whose named output (the `:=` / `=` LHS)
// matches the given text.
function outputStmt(name: string, fixtureName: string): StmtNode {
    const { blocks } = extractRecipe(fixture(fixtureName));
    const recipe = parse(blocks[0]) as { stmts: StmtNode[] };
    const stmt = recipe.stmts.find(
        (s) => s.outputs?.some((o) => substringsText(o.substrings) === name),
    );
    assert.ok(stmt, `expected a statement with output "${name}"`);
    return stmt;
}

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

test('kitchen-sink: `:=` produces a single named output and marks the statement named', () => {
    const stmt = outputStmt('Dough', 'kitchen-sink.md');
    assert.equal(stmt.named, true);
    assert.equal(stmt.outputs?.length, 1);
});

test('kitchen-sink: a step statement exposes its name and one input per argument', () => {
    const stmt = outputStmt('Dough', 'kitchen-sink.md');
    const step = stmt.expr as StepNode;
    assert.equal(step.kind, 'step');
    assert.equal(substringsText(step.name.substrings), 'knead');
    assert.equal(step.inputs.length, 3);

    const [flour, butter, milk] = step.inputs as ReferenceNode[];

    // Input 0: double-quoted name kept intact, absolute quantity 200g.
    assert.equal(flour.kind, 'reference');
    assert.equal(nameText(flour), 'plain flour (12% protein)');
    const flourQ = flour.amount as QuantityNode;
    assert.equal(flourQ.kind, 'quantity');
    assert.equal(flourQ.value, 200);
    assert.equal(substringsText(flourQ.unit!.substrings), 'g');

    // Input 1: fractional quantity 1/2 cup (exact fraction, spaced unit).
    assert.equal(butter.kind, 'reference');
    assert.equal(nameText(butter), 'butter');
    const butterQ = butter.amount as QuantityNode;
    assert.deepEqual(butterQ.value, { numerator: 1, denominator: 2 });
    assert.equal(substringsText(butterQ.unit!.substrings), 'cup');
    assert.equal(butterQ.valueUnitSpacing, ' ');

    // Input 2: bare ingredient, no amount.
    assert.equal(milk.kind, 'reference');
    assert.equal(nameText(milk), 'milk');
    assert.equal(milk.amount, null);
});

test('kitchen-sink: a step input may itself be a step (steps nest recursively)', () => {
    const filling = outputStmt('Filling', 'kitchen-sink.md');
    assert.equal(filling.named, true);

    const fold = filling.expr as StepNode;
    assert.equal(fold.kind, 'step');
    assert.equal(substringsText(fold.name.substrings), 'fold');
    assert.equal(fold.inputs.length, 2);

    // Both inputs of `fold` are themselves steps (nesting, not flat inputs).
    const [whip, mix] = fold.inputs as StepNode[];
    assert.equal(whip.kind, 'step');
    assert.equal(substringsText(whip.name.substrings), 'whip');
    assert.equal(mix.kind, 'step');
    assert.equal(substringsText(mix.name.substrings), 'mix');
});

test('kitchen-sink: an unbraced quantity on a deeply nested reference is an amount', () => {
    const filling = outputStmt('Filling', 'kitchen-sink.md');
    const fold = filling.expr as StepNode;
    const whip = fold.inputs[0] as StepNode;
    assert.equal(whip.inputs.length, 2);

    const [cream, sugar] = whip.inputs as ReferenceNode[];
    assert.equal(nameText(cream), 'cream');
    assert.equal(cream.amount, null);

    // `2 tbsp sugar` — a plain (unbraced) quantity, not an interpolated name.
    assert.equal(nameText(sugar), 'sugar');
    const sugarQ = sugar.amount as QuantityNode;
    assert.equal(sugarQ.kind, 'quantity');
    assert.equal(sugarQ.value, 2);
    assert.equal(substringsText(sugarQ.unit!.substrings), 'tbsp');
    assert.equal(sugarQ.valueUnitSpacing, ' ');
});

test('kitchen-sink: `Remaining` on a deeply nested reference is a remainder amount', () => {
    const filling = outputStmt('Filling', 'kitchen-sink.md');
    const fold = filling.expr as StepNode;
    const mix = fold.inputs[1] as StepNode;
    assert.equal(mix.inputs.length, 2);

    const [redPeppers, butter] = mix.inputs as ReferenceNode[];
    assert.equal(nameText(redPeppers), 'red peppers');
    assert.equal(redPeppers.amount, null);

    // `Remaining butter` — the amount is a remainder, wording preserved as authored.
    assert.equal(nameText(butter), 'butter');
    const rem = butter.amount as RemainderNode;
    assert.equal(rem.kind, 'remainder');
    assert.equal(rem.wording, 'Remaining');
});

interface ExternalRefNode {
    kind: 'externalReference';
    name: string;
    targetSlug: string;
    title?: string;
}

test('kitchen-sink: external reference forms (bare, "-title, \'-title, and as a step)', () => {
    const { blocks } = extractRecipe(fixture('kitchen-sink.md'));
    const stmts = (parse(blocks[0]) as { stmts: StmtNode[] }).stmts;

    // Bare link: name + slug, no title.
    const bare = stmts[11].expr as ExternalRefNode;
    assert.deepEqual(
        { kind: bare.kind, name: bare.name, targetSlug: bare.targetSlug, title: bare.title },
        { kind: 'externalReference', name: 'Pizza Dough', targetSlug: 'pizza-dough', title: undefined },
    );

    // Double-quoted title (apostrophe inside preserved).
    const dq = stmts[12].expr as ExternalRefNode;
    assert.equal(dq.title, "Dad's basic roux");

    // Single-quoted title.
    const sq = stmts[13].expr as ExternalRefNode;
    assert.equal(sq.title, 'homemade stock');

    // As a step: the `, action` fold wraps the external reference as the step's input.
    const step = stmts[14].expr as StepNode;
    assert.equal(step.kind, 'step');
    assert.equal(substringsText(step.name.substrings), 'rolled thin');
    const input = step.inputs[0] as ExternalRefNode;
    assert.equal(input.kind, 'externalReference');
    assert.equal(input.targetSlug, 'sweet-pastry');
});
