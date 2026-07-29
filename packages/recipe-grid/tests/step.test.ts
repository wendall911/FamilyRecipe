import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parse } from '../src/generated/grammar.generated.js';
import { findAll } from './helpers.js';

interface StringNode {
    substrings: { string: string }[];
}
interface StepNode {
    kind: 'step';
    name: StringNode;
    inputs: { kind: string }[];
}

function steps(src: string): StepNode[] {
    return findAll(parse(src), (o) => o.kind === 'step') as unknown as StepNode[];
}
const stepName = (s: StepNode): string => s.name.substrings.map((x) => x.string).join('');

// step: name + inputs (arity). Assert this rule's own shape, not the inputs' internals.
test('step with one input: name and single input', () => {
    const top = steps('crush(digestives)\n')[0];
    assert.equal(stepName(top), 'crush');
    assert.equal(top.inputs.length, 1);
});

test('step with two inputs: name and input count', () => {
    const top = steps('mix(cocoa, syrup)\n')[0];
    assert.equal(stepName(top), 'mix');
    assert.equal(top.inputs.length, 2);
});

test('step name may be multiple words', () => {
    const top = steps('heat until bubbling(cocoa, syrup)\n')[0];
    assert.equal(stepName(top), 'heat until bubbling');
    assert.equal(top.inputs.length, 2);
});

// ltr_shorthand: a comma list folds left-to-right into nested steps.
// (synthetic input — no current recipe fixture uses the shorthand form.)
test('ltr_shorthand folds a comma list into nested steps', () => {
    const top = steps('1kg potatoes, peeled, cubed\n')[0];
    // outermost is the last verb, wrapping the previous, wrapping the reference.
    assert.equal(stepName(top), 'cubed');
    assert.equal(top.inputs.length, 1);
    const inner = top.inputs[0] as unknown as StepNode;
    assert.equal(stepName(inner), 'peeled');
    assert.equal(inner.inputs.length, 1);
    assert.equal(inner.inputs[0].kind, 'reference');
});

// expr: a parenthesised expression is unwrapped, not double-wrapped.
test('expr unwraps redundant parentheses', () => {
    const top = steps('mix((crush(digestives)), melt(chocolate))\n')[0];
    assert.equal(stepName(top), 'mix');
    assert.equal(top.inputs.length, 2);
    // the parenthesised first input is the crush step directly, not a wrapper around it.
    const firstInput = top.inputs[0] as unknown as StepNode;
    assert.equal(firstInput.kind, 'step');
    assert.equal(stepName(firstInput), 'crush');
});
