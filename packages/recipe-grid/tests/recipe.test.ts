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

interface StmtNode {
    kind: 'stmt';
    expr: { kind: string };
}
interface RecipeNode {
    kind: 'recipe';
    stmts: StmtNode[];
}

// Parse a whole fixture .md through the real extract -> parse path and return
// the grammar's Recipe node for its single recipe block.
function recipeOf(fixtureName: string): RecipeNode {
    const { blocks } = extractRecipe(fixture(fixtureName));
    assert.equal(blocks.length, 1, `expected one recipe block in ${fixtureName}`);
    return parse(blocks[0]) as unknown as RecipeNode;
}

test('tiffin block parses to a Recipe of 7 statements ending in a step', () => {
    const recipe = recipeOf('tiffin.md');
    assert.equal(recipe.kind, 'recipe');
    assert.equal(recipe.stmts.length, 7);
    assert.equal(recipe.stmts[recipe.stmts.length - 1].expr.kind, 'step');
});

test('egg-fried-rice block parses to a Recipe of 10 statements ending in a step', () => {
    const recipe = recipeOf('egg-fried-rice.md');
    assert.equal(recipe.kind, 'recipe');
    assert.equal(recipe.stmts.length, 10);
    assert.equal(recipe.stmts[recipe.stmts.length - 1].expr.kind, 'step');
});

interface StringNode {
    substrings: { string: string }[];
}
interface ReferenceNode {
    kind: 'reference';
    name: StringNode;
    amount:
        | { kind: 'quantity'; value: unknown; unit: StringNode | null }
        | { kind: 'remainder'; wording: string }
        | null;
}

// Collect every reference node in a parse tree, recursing object keys.
function referencesOf(node: unknown, out: ReferenceNode[] = []): ReferenceNode[] {
    if (node && typeof node === 'object') {
        if ((node as { kind?: string }).kind === 'reference') out.push(node as ReferenceNode);
        for (const value of Object.values(node)) {
            if (Array.isArray(value)) value.forEach((v) => referencesOf(v, out));
            else if (value && typeof value === 'object') referencesOf(value, out);
        }
    }
    return out;
}

const nameText = (r: ReferenceNode): string => r.name.substrings.map((s) => s.string).join('');

// acid-phosphate is the structurally-correct case: one "560ml distilled water"
// ingredient, referenced partially (210ml) then by remainder. It exercises the
// remainder amount, a partial-quantity reference, and a null amount ("all of it").
test('acid-phosphate: frontmatter metadata is extracted', () => {
    const { title, meta } = extractRecipe(fixture('acid-phosphate.md'));
    assert.equal(title, 'Acid Phosphate');
    assert.deepEqual(meta, { scalingType: 'servings', base: 1, slug: 'acid-phosphate' });
});

test('acid-phosphate block parses to a Recipe of 6 statements', () => {
    const recipe = recipeOf('acid-phosphate.md');
    assert.equal(recipe.kind, 'recipe');
    assert.equal(recipe.stmts.length, 6);
});

test('acid-phosphate: a reference uses the remainder amount', () => {
    const recipe = recipeOf('acid-phosphate.md');
    const remainder = referencesOf(recipe).find((r) => r.amount?.kind === 'remainder');
    assert.ok(remainder, 'expected a reference with a remainder amount');
    assert.equal(nameText(remainder), 'distilled water');
    assert.equal((remainder.amount as { wording: string }).wording, 'Remaining');
});

test('acid-phosphate: the same water is referenced with a partial quantity', () => {
    const recipe = recipeOf('acid-phosphate.md');
    const partial = referencesOf(recipe).find(
        (r) => r.amount?.kind === 'quantity' && r.amount.value === 210,
    );
    assert.ok(partial, 'expected a 210ml partial-quantity reference');
    assert.equal(nameText(partial), 'distilled water');
});

test('acid-phosphate: a reference with no amount means all of it', () => {
    const recipe = recipeOf('acid-phosphate.md');
    const nullAmount = referencesOf(recipe).find(
        (r) => nameText(r) === 'Phosphoric Acid 85% USP' && r.amount === null,
    );
    assert.ok(nullAmount, 'expected a Phosphoric Acid reference with no amount');
});
