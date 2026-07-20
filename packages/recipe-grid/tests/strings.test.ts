import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parse } from '../src/generated/grammar.generated.js';
import { findAll } from './helpers.ts';

function substringsOf(src: string): { offset: number; string: string }[] {
    const strings = findAll(parse(src), (o) => o.kind === 'string');
    assert.ok(strings.length >= 1, `expected a string node in: ${JSON.stringify(src)}`);
    return strings[0].substrings as { offset: number; string: string }[];
}

test('single word is one substring', () => {
    assert.deepEqual(substringsOf('chocolate\n'), [{ kind: 'substring', offset: 0, string: 'chocolate' }]);
});

test('two words join with the whitespace substring at its own offset', () => {
    assert.deepEqual(substringsOf('cocoa powder\n'), [
        { kind: 'substring', offset: 0, string: 'cocoa' },
        { kind: 'substring', offset: 5, string: ' ' },
        { kind: 'substring', offset: 6, string: 'powder' },
    ]);
});

test('three words interleave words and whitespace with correct offsets', () => {
    assert.deepEqual(substringsOf('heat until bubbling\n'), [
        { kind: 'substring', offset: 0, string: 'heat' },
        { kind: 'substring', offset: 4, string: ' ' },
        { kind: 'substring', offset: 5, string: 'until' },
        { kind: 'substring', offset: 10, string: ' ' },
        { kind: 'substring', offset: 11, string: 'bubbling' },
    ]);
});
