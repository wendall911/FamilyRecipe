import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    externalRef,
    nameText,
    subRecipeStmt,
    referencesOf,
    remainderRef,
    stepStmt,
    substringsText,
} from './libs/ast-helpers.ts';
import type {
    ExternalReference as ExternalRefNode,
    Quantity as QuantityNode,
    Reference as ReferenceNode,
    Remainder as RemainderNode,
    Step as StepNode,
} from '../src/ast.ts';

/*
 * The contrived kitchen-sink fixture packs awkward-but-real constructs so tests
 * pin down how each is handled. It is not a real recipe.
 */

/* --- Ingredients ---------------------------------------------------------
 *
 * An ingredient line reads the same on a card whether it is a bare ingredient,
 * an ingredient with an action, or a link to another recipe. In the AST they
 * are three different nodes: `reference`, a `step` wrapping a `reference`, and
 * `externalReference`.
 */

test('double-quoted name is a literal, not parsed for quantity or unit', () => {
    const refs = referencesOf('kitchen-sink.md');
    const flour = refs.find((r) => nameText(r).includes('plain flour'));
    assert.ok(flour, 'expected a plain flour reference');
    assert.equal(nameText(flour), 'plain flour (12% protein)');
});

test('single-quoted name is a literal, not parsed for quantity or unit', () => {
    const refs = referencesOf('kitchen-sink.md');
    const veg = refs.find((r) => nameText(r).includes('mixed veg'));
    assert.ok(veg, 'expected a mixed veg reference');
    assert.equal(nameText(veg), 'mixed veg (e.g. carrots, peas)');
});

test('{N} is an interpolated (scalable) value inside the name, not an amount', () => {
    const refs = referencesOf('kitchen-sink.md');
    const parsley = refs.find((r) => nameText(r).includes('parsley'));
    assert.ok(parsley, 'expected a parsley reference');
    // The {1} became a scalable interpolated value embedded in the name.
    const interp = parsley.name.substrings.find((p) => p.kind === 'interpolatedValue');
    assert.ok(interp, 'expected an interpolated value in the parsley name');
    assert.deepEqual(interp.number, 1);
    // The braces did not produce a reference amount.
    assert.equal(parsley.amount, null);

    const [value, text] = parsley.name.substrings;

    assert.equal(value.kind, 'interpolatedValue');
    assert.equal(substringsText([text]), 'handful');
});

test('a quantity value carries its authored kind: integer, decimal, or exact fraction', () => {
    const refs = referencesOf('kitchen-sink.md');
    const amountOf = (name: string): QuantityNode => {
        const ref = refs.find((r) => nameText(r) === name);

        assert.ok(ref, `expected a ${name} reference`);

        return ref.amount as QuantityNode;
    };

    // `200g` - a whole number stays a JS number.
    assert.equal(amountOf('plain flour (12% protein)').value, 200);

    // `0.5 tsp` - a decimal stays a JS number; it is not converted to a fraction.
    assert.equal(amountOf('salt').value, 0.5);

    // `1/2 cup` - an exact fraction is held as numerator/denominator, not 0.5.
    assert.deepEqual(amountOf('butter').value, { numerator: 1, denominator: 2 });
});

test('a quantity carries its unit as a part with what preceded it', () => {
    const refs = referencesOf('kitchen-sink.md');
    const amountOf = (name: string): QuantityNode => {
        const ref = refs.find((r) => nameText(r) === name);

        assert.ok(ref, `expected a ${name} reference`);

        return ref.amount as QuantityNode;
    };

    // `200g` - the unit abuts the value, so it led with nothing.
    const flour = amountOf('plain flour (12% protein)');

    assert.equal(substringsText(flour.parts[0].text.substrings), 'g');
    assert.equal(flour.parts[0].leading, '');

    /* 
     * `2 large eggs` - the unit is a word, and the space before it rides the
     * part rather than sitting between the value and the unit.
     */
    const eggs = amountOf('eggs');

    assert.equal(substringsText(eggs.parts[0].text.substrings), 'large');
    assert.equal(eggs.parts[0].leading, ' ');

    /*
     * `1 'mixed veg (...)'` - the quoted name takes everything after the
     * value, so the amount is the bare count.
     */
    const veg = amountOf('mixed veg (e.g. carrots, peas)');

    assert.equal(veg.value, 1);
    assert.equal(veg.parts.length, 0);
});

test('a preposition is a part of its own, following the unit', () => {
    const refs = referencesOf('kitchen-sink.md');

    /*
     * `3 liters of cat memes` - two `cat memes` references exist; this is the
     * one carrying the quantity, not the bare use inside `mix`.
     */
    const declared = refs.find((r) => nameText(r) === 'cat memes' && r.amount !== null);

    assert.ok(declared, 'expected a cat memes reference with an amount');

    const amount = declared.amount as QuantityNode;

    assert.equal(amount.value, 3);

    // The unit and the preposition are parts in the order authored.
    assert.equal(amount.parts.length, 2);

    const [unit, preposition] = amount.parts;

    assert.equal(substringsText(unit.text.substrings), 'liters');
    assert.equal(unit.leading, ' ');

    /*
     * The preposition holds only its own word; the space before it is what
     * preceded the part, not part of the text.
     */
    assert.equal(substringsText(preposition.text.substrings), 'of');
    assert.equal(preposition.leading, ' ');

    assert.equal(nameText(declared), 'cat memes');
});

test('an ingredient with a trailing action is a step wrapping that ingredient', () => {
    const stmt = stepStmt('chopped', 'kitchen-sink.md');
    const step = stmt.expr as StepNode;

    // `{1 handful} fresh parsley, chopped` - the action names the step.
    assert.equal(step.kind, 'step');
    assert.equal(nameText(step), 'chopped');

    // The ingredient did not stay at statement level; it is the step's input.
    assert.equal(step.inputs.length, 1);

    const parsley = step.inputs[0] as ReferenceNode;

    assert.equal(parsley.kind, 'reference');
});

test('a label on an ingredient with an action rides the step, and the amount stays on the ingredient', () => {
    const stmt = stepStmt('finely chopped', 'kitchen-sink.md');
    const step = stmt.expr as StepNode;

    // `red peppers = 150g roasted red peppers from jar, finely chopped`
    assert.equal(nameText(step), 'finely chopped');
    assert.equal(substringsText(step.label!.substrings), 'red peppers');

    const peppers = step.inputs[0] as ReferenceNode;

    assert.equal(nameText(peppers), 'roasted red peppers from jar');
    assert.equal(peppers.label, undefined);

    const amount = peppers.amount as QuantityNode;

    assert.equal(amount.value, 150);
    assert.equal(substringsText(amount.parts[0].text.substrings), 'g');
});

test('an external reference carries link text and slug, and a title when authored', () => {
    // `[Pizza Dough](pizza-dough)` - no title in the link.
    const bare = externalRef('Pizza Dough', 'kitchen-sink.md');

    assert.equal(bare.kind, 'externalReference');
    assert.equal(bare.targetSlug, 'pizza-dough');
    assert.equal(bare.title, undefined);

    // `[Roux](roux "Dad's basic roux")` - a double-quoted title, apostrophe intact.
    const roux = externalRef('Roux', 'kitchen-sink.md');

    assert.equal(roux.targetSlug, 'roux');
    assert.equal(roux.title, "Dad's basic roux");

    // `[Stock](vegetable-stock 'homemade stock')` - a single-quoted title.
    const stock = externalRef('Stock', 'kitchen-sink.md');

    assert.equal(stock.targetSlug, 'vegetable-stock');
    assert.equal(stock.title, 'homemade stock');
});

test('an external reference with a trailing action is a step wrapping that reference', () => {
    const stmt = stepStmt('rolled thin', 'kitchen-sink.md');
    const step = stmt.expr as StepNode;

    /*
     * `[Pastry](sweet-pastry), rolled thin` - the same wrapping as an
     * ingredient with an action, with an external reference as the input.
     */
    assert.equal(step.kind, 'step');
    assert.equal(step.inputs.length, 1);

    const pastry = step.inputs[0] as ExternalRefNode;

    assert.equal(pastry.kind, 'externalReference');
    assert.equal(pastry.name, 'Pastry');
    assert.equal(pastry.targetSlug, 'sweet-pastry');
});

test('an external reference carries a leading amount as an authored RecipeNumber', () => {
    /*
     * `1/1 [Yet Another Pizza Dough](pizza-dough-too '…')` - the authored
     * fraction comes back as numerator/denominator.
     */
    const dough = externalRef('Yet Another Pizza Dough', 'kitchen-sink.md');
    const amount = dough.amount as QuantityNode;

    assert.deepEqual(amount.value, { numerator: 1, denominator: 1 });
});

/* --- SubRecipe ----------------------------------------------------------- */

test('`:=` produces a heading', () => {
    const stmt = subRecipeStmt('Dough', 'kitchen-sink.md');
    assert.equal(stmt.heading?.kind, 'string');
});

test('a subrecipe wraps a step, and the arguments in its parens are the step inputs', () => {
    const stmt = subRecipeStmt('Dough', 'kitchen-sink.md');
    const step = stmt.expr as StepNode;

    // `Dough := knead(...)` - the subrecipe's expression is the step it wraps.
    assert.equal(step.kind, 'step');
    assert.equal(nameText(step), 'knead');

    // The three arguments became the step's inputs, in the order authored.
    assert.deepEqual(
        (step.inputs as ReferenceNode[]).map(nameText),
        ['plain flour (12% protein)', 'butter', 'milk'],
    );
});

test('a step input may itself be a step (steps nest recursively)', () => {
    const fold = subRecipeStmt('Filling', 'kitchen-sink.md').expr as StepNode;

    assert.equal(nameText(fold), 'fold');

    // Both inputs of `fold` are themselves steps, not flat references.
    const inputs = fold.inputs as StepNode[];

    assert.deepEqual(
        inputs.map((i) => i.kind),
        ['step', 'step'],
    );
    assert.deepEqual(inputs.map(nameText), ['whip', 'mix']);
});

/* --- Recipe --------------------------------------------------------------
 *
 * An ingredient list entry never carries a remainder. `Amount` is a `quantity`
 * or a `remainder`, and a remainder only appears on a reference inside a step -
 * whether that step is the recipe's entry point or a child.
 */

test('`Remaining` on a reference inside a step is a remainder amount', () => {
    /*
     * `Remaining butter` - found by what it is, since a remainder sits at no
     * fixed position among a step's inputs.
     */
    const butter = remainderRef('butter', 'kitchen-sink.md');
    const rem = butter.amount as RemainderNode;

    // The wording is preserved as authored; it is what the card renders.
    assert.equal(rem.kind, 'remainder');
    assert.equal(rem.wording, 'Remaining');
});
