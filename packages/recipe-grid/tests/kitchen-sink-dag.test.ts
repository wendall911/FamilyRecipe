import { test } from 'node:test';
import assert from 'node:assert/strict';

import { compileFixture } from './libs/dag-harness.ts';
import {
    normaliseOutputName,
    numberValue,
    recipeNumbersEqual,
    svsEqual,
    svsNormalize,
    svsToString,
} from '../src/recipe-model.ts';
import type {
    Fraction,
    Ingredient,
    Quantity,
    Recipe,
    RecipeNumber,
    RecipeReference,
    Reference,
    Remainder,
    Step,
    SubRecipe,
} from '../src/model.ts';

/*
 * The kitchen-sink fixture compiled to the DAG. The AST tests pin what the
 * grammar emits; these pin what the compiler builds from it -- resolved
 * references, unit identity, and the shapes a binding consumes.
 *
 * Every type imported above is a piece the DAG carries. The import list is the
 * checklist: each one should be reached by a test in this file.
 */

/* --- Ingredients ---------------------------------------------------------
 *
 * The weight-bearing node. An AST `reference` entry becomes an `ingredient`,
 * an `externalReference` becomes a `recipeReference`, and an entry with a
 * trailing action becomes a `step` wrapping one. Descriptions arrive as
 * ScaledValueString; a quantity carries both the authored unit and the
 * canonical key it resolves to.
 */

test('an ingredient line compiles to an ingredient carrying its description', () => {
    const recipe = compileFixture('kitchen-sink.md');

    /*
     * `200g "plain flour (12% protein)"` -- found by what it is, not where it
     * sits, so adding to the fixture does not move it out from under the test.
     */
    const flour = recipe.recipeTrees.find(
        (node): node is Ingredient =>
            node.kind === 'ingredient'
            && svsToString(node.description) === 'plain flour (12% protein)',
    );

    assert.ok(flour, 'expected a plain flour ingredient');
});

test('a quantity carries the authored unit and the canonical key it resolves to', () => {
    const recipe = compileFixture('kitchen-sink.md');
    const quantityOf = (description: string): Quantity => {
        const node = recipe.recipeTrees.find(
            (n): n is Ingredient =>
                n.kind === 'ingredient' && svsToString(n.description) === description,
        );

        assert.ok(node, `expected a ${description} ingredient`);
        assert.ok(node.quantity, `expected ${description} to carry a quantity`);

        return node.quantity;
    };

    /*
     * `3 cloves garlic` -- the plural as authored, resolved to the singular
     * `unitsOfMeasure` key. Both are carried; neither replaces the other.
     */
    const garlic = quantityOf('garlic');

    assert.equal(garlic.unitOfMeasure, 'cloves');
    assert.equal(garlic.unitOfMeasureID, 'clove');

    /*
     * `1 'mixed veg (...)'` -- a count with no unit. The identity is null
     * exactly when the authored unit is.
     */
    const veg = quantityOf('mixed veg (e.g. carrots, peas)');

    assert.equal(veg.unitOfMeasure, null);
    assert.equal(veg.unitOfMeasureID, null);
});

test('an ingredient line becomes an ingredient, a step, or a recipeReference', () => {
    const recipe = compileFixture('kitchen-sink.md');

    /*
     * `{1 handful} fresh parsley, chopped` -- the trailing action makes the
     * entry a step, and the ingredient becomes its input. One input: the step
     * wraps the ingredient the action followed, and nothing else.
     */
    const chopped = recipe.recipeTrees.find(
        (n): n is Step => n.kind === 'step' && svsToString(n.description) === 'chopped',
    );

    assert.ok(chopped, 'expected a chopped step');
    assert.equal(chopped.inputs.length, 1);
    assert.equal(chopped.inputs[0].kind, 'ingredient');

    /*
     * `[Roux](roux "Dad's basic roux")` -- a link is a cross-file pointer,
     * carrying the slug it targets and the authored title.
     */
    const roux = recipe.recipeTrees.find(
        (n): n is RecipeReference => n.kind === 'recipeReference' && n.name === 'Roux',
    );

    assert.ok(roux, 'expected a Roux recipeReference');
    assert.equal(roux.targetSlug, 'roux');
    assert.equal(roux.title, "Dad's basic roux");
});

test('a label rides the step and does not displace the ingredient description', () => {
    const recipe = compileFixture('kitchen-sink.md');

    /*
     * `red peppers = 150g roasted red peppers from jar, finely chopped` -- the
     * label is the handle a later line resolves against. The step carries it;
     * the ingredient under it keeps its own description and takes no label.
     */
    const peppers = recipe.recipeTrees.find(
        (n): n is Step => n.kind === 'step' && n.label === 'red peppers',
    );

    assert.ok(peppers, 'expected a step labelled red peppers');
    assert.equal(svsToString(peppers.description), 'finely chopped');

    const jarred = peppers.inputs.find(
        (n): n is Ingredient => n.kind === 'ingredient',
    );

    assert.ok(jarred, 'expected an ingredient under the labelled step');
    assert.equal(svsToString(jarred.description), 'roasted red peppers from jar');
    assert.equal(jarred.label, undefined);
});

test('a braced value stays a number in the description, not text', () => {
    const recipe = compileFixture('kitchen-sink.md');

    /*
     * `{1 handful} fresh parsley, chopped` -- the braces mark the number
     * scalable, so it arrives as a number part among the literal text. Compared
     * structurally: svsToString would flatten it back to a string and lose the
     * distinction the braces made.
     */
    const chopped = recipe.recipeTrees.find(
        (n): n is Step => n.kind === 'step' && svsToString(n.description) === 'chopped',
    );

    assert.ok(chopped, 'expected a chopped step');

    const parsley = chopped.inputs.find((n): n is Ingredient => n.kind === 'ingredient');

    assert.ok(parsley, 'expected an ingredient under the chopped step');
    assert.ok(
        svsEqual(parsley.description, svsNormalize([1, ' handful fresh parsley'])),
        'expected the braced value to stay a number part',
    );

    // The braces marked a value, not an amount.
    assert.equal(parsley.quantity, null);
});

test('a quantity value keeps the kind it was authored in', () => {
    const recipe = compileFixture('kitchen-sink.md');
    const valueOf = (description: string): RecipeNumber => {
        const node = recipe.recipeTrees.find(
            (n): n is Ingredient =>
                n.kind === 'ingredient' && svsToString(n.description) === description,
        );

        assert.ok(node, `expected a ${description} ingredient`);
        assert.ok(node.quantity, `expected ${description} to carry a quantity`);

        return node.quantity.value;
    };

    /*
     * `1/2 cup butter` and `0.5 tsp salt` -- the same magnitude authored two
     * ways. The fraction stays exact and the decimal stays a JS number; the
     * compiler represents what was written and converts neither.
     */
    const butter = valueOf('butter');
    const salt = valueOf('salt');
    const half: Fraction = { numerator: 1, denominator: 2 };
    const quarter: Fraction = { numerator: 1, denominator: 4 };

    assert.deepEqual(butter, half);
    assert.equal(salt, 0.5);

    // Equal in magnitude, so a float comparison cannot tell them apart.
    assert.equal(numberValue(butter), numberValue(salt));

    // Distinguishable structurally, which is what preserves the authored form.
    assert.ok(
        !recipeNumbersEqual(butter, quarter),
        'expected an exact fraction to compare on numerator and denominator',
    );
});

/* --- SubRecipe -----------------------------------------------------------
 *
 * A named region composing ingredients, steps, and whatever else. Its output
 * is what a later line reaches by name -- a `reference` holding `resolvedNode`,
 * a pointer to the node it targets. That back-edge is what makes the compiled
 * recipe a DAG rather than a tree.
 */

/* --- Recipe --------------------------------------------------------------
 *
 * The entry point the rest is structured into: roots, the follows chain, and
 * the frontmatter the compiler stamps on.
 */
