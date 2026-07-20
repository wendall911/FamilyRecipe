/**
 * Generate the parser from grammar.peggy.
 *
 * The grammar contains a `@KNOWN_UNITS@` placeholder (as in the canonical
 * recipe_grid grammar). This substitutes the Peggy ordered-choice fragment
 * built from units.ts — the single source of truth for unit names — then runs
 * peggy on the resulting grammar, writing the committed parser + types.
 */

import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

import { KNOWN_UNITS_PEGGY } from '../src/units.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const srcDir = fileURLToPath(new URL('../src/', import.meta.url));
const generatedDir = fileURLToPath(new URL('../src//generated/', import.meta.url));

const grammar = readFileSync(`${srcDir}grammar.peggy`, 'utf8');
const substituted = grammar.replace(/@KNOWN_UNITS@/g, KNOWN_UNITS_PEGGY);

const tmpGrammar = `${srcDir}grammar.substituted.peggy`;
writeFileSync(tmpGrammar, substituted);

try {
    execFileSync(
        `${here}../node_modules/.bin/peggy`,
        ['--format', 'es', '--dts', '-o', `${generatedDir}grammar.generated.js`, tmpGrammar],
        { stdio: 'inherit' },
    );
} finally {
    rmSync(tmpGrammar);
}
