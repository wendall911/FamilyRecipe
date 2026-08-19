import { test } from 'node:test';
import assert from 'node:assert/strict';

import { compileFixture } from './libs/dag-harness.ts';
import { isReference, isStep } from './libs/dag-helpers.ts';
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
 * grammar emits; these pin what the compiler builds from it, the resolved
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
     * `200g "plain flour (12% protein)"` - found by what it is, not where it
     * sits, so adding to the fixture does not move it out from under the test.
     */
    const flour = recipe.recipeTrees.find(
        (node): node is Ingredient =>
            node.kind === 'ingredient'
            && svsToString(node.description) === 'plain flour (12% protein)',
    );

    assert.ok(flour, 'expected a plain flour ingredient');
});

test('a quantity carries its parts, each with the canonical key it resolves to', () => {
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
     * `3 cloves garlic` - the plural as authored, resolved to the singular
     * `unitsOfMeasure` key. Both are carried; neither replaces the other.
     */
    const garlic = quantityOf('garlic');

    assert.equal(garlic.parts[0].text, 'cloves');
    assert.equal(garlic.parts[0].isUnitName, true);

    // A space preceded the unit, and rides the part rather than sitting between.
    assert.equal(garlic.parts[0].leading, ' ');

    /*
     * `200g "plain flour (12% protein)"` - the unit abuts the value, so it led
     * with nothing. The absence is as authored, not a missing separator.
     */
    const flour = quantityOf('plain flour (12% protein)');

    assert.equal(flour.parts[0].text, 'g');
    assert.equal(flour.parts[0].leading, '');

    /*
     * `3 liters of cat memes` - every part is asked. `liters` is a unit name
     * and resolves; `of` is not and carries null.
     */
    const memes = quantityOf('cat memes');

    assert.equal(memes.parts[0].text, 'liters');
    assert.equal(memes.parts[0].isUnitName, true);
    assert.equal(memes.parts[1].text, 'of');
    assert.equal(memes.parts[1].isUnitName, false);

    /*
     * `1 'mixed veg (...)'` - the quoted name takes everything after the
     * value, so the amount is the bare count and there is no part.
     */
    const veg = quantityOf('mixed veg (e.g. carrots, peas)');

    assert.equal(veg.parts.length, 0);
});

test('an ingredient line becomes an ingredient, a step, or a recipeReference', () => {
    const recipe = compileFixture('kitchen-sink.md');

    /*
     * `{1 handful} fresh parsley, chopped` - the trailing action makes the
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
     * `[Roux](roux "Dad's basic roux")` - a link is a cross-file pointer,
     * carrying the slug it targets and the authored title.
     */
    const roux = recipe.recipeTrees.find(
        (n): n is RecipeReference => n.kind === 'recipeReference' && n.name === 'Roux',
    );

    assert.ok(roux, 'expected a Roux recipeReference');
    assert.equal(roux.targetSlug, 'roux');
    assert.equal(roux.title, "Dad's basic roux");
});

test('A recipeReference with a quantity carries correctly', () => {
    const recipe = compileFixture('kitchen-sink.md');

    /*
     * `1/1 [Yet Another Pizza Dough](pizza-dough-too '…')` - the authored
     * fraction comes back as numerator/denominator.
     */
    const yapd = recipe.recipeTrees.find(
        (n): n is RecipeReference => n.kind === 'recipeReference'
            && n.name === 'Yet Another Pizza Dough',
    );

    assert.ok(yapd, 'expected a YAPD recipeReference');
    assert.deepEqual(yapd.amount, { numerator: 1, denominator: 1 });
});

test('a label rides the step and does not displace the ingredient description', () => {
    const recipe = compileFixture('kitchen-sink.md');

    /*
     * `red peppers = 150g roasted red peppers from jar, finely chopped` - the
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
     * `{1 handful} fresh parsley, chopped` - the braces mark the number
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
        svsEqual(parsley.description, svsNormalize([1, 'handful fresh parsley'])),
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
     * `1/2 cup butter` and `0.5 tsp salt` - the same magnitude authored two
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
 * is what a later line reaches by name - a `reference` holding `resolvedNode`,
 * a pointer to the node it targets. That back-edge is what makes the compiled
 * recipe a DAG rather than a tree.
 */

test('a := heading compiles to a subRecipe wrapping the step it names', () => {
    const recipe = compileFixture('kitchen-sink.md');

    /*
     * `Dough := knead(...)` - the heading names a region; the node carries the
     * declared output name and wraps the step the `:=` bound. Found by its
     * output name rather than position, so the fixture can grow around it.
     */
    const dough = recipe.recipeTrees.find(
        (node): node is SubRecipe =>
            node.kind === 'subRecipe'
            && node.outputNames.some((output) => normaliseOutputName(output) === 'dough'),
    );

    assert.ok(dough, 'expected a Dough subRecipe');

    // One declared output: `Dough :=` names a single result.
    assert.equal(dough.outputNames.length, 1);

    /*
     * The `:=` wraps exactly one child tree - here the `knead` step whose
     * arguments are the region's inputs. The guard is the assertion, so a
     * subTree that stops being a step fails here rather than reading undefined
     * off a cast.
     */
    const subTree = dough.subTree;

    assert.ok(isStep(subTree), 'expected the subTree to be a step');
    assert.equal(svsToString(subTree.description), 'knead');
});

test('a later line reaching a := output resolves to that node, not a copy', () => {
    const recipe = compileFixture('kitchen-sink.md');

    /*
     * `Dough := knead(...)` declared above; `bake(mix(dough, ...))` reaches it
     * by name. The reference holds the subRecipe object itself, so the node has
     * a second parent - the back-edge that makes this a DAG rather than a tree.
     */
    const dough = recipe.recipeTrees.find(
        (node): node is SubRecipe =>
            node.kind === 'subRecipe'
            && node.outputNames.some((output) => normaliseOutputName(output) === 'dough'),
    );

    assert.ok(dough, 'expected a Dough subRecipe');

    const bake = recipe.recipeTrees.find(
        (node): node is Step => node.kind === 'step' && svsToString(node.description) === 'bake',
    );

    assert.ok(bake, 'expected a bake step');

    const mix = bake.inputs.find(
        (node): node is Step => isStep(node) && svsToString(node.description) === 'mix',
    );

    assert.ok(mix, 'expected a mix step under bake');

    const toDough = mix.inputs.find(
        (node): node is Reference => isReference(node) && node.resolvedNode === dough,
    );

    /*
     * Object identity, not a structural comparison: a deep-equal copy would
     * satisfy a shape check while being a separate node, which is the tree the
     * DAG is not.
     */
    assert.ok(toDough, 'expected a reference resolving to the Dough subRecipe');
});

test('a reference carries an amount only when the line draws a measured portion', () => {
    const recipe = compileFixture('kitchen-sink.md');

    /*
     * `Dough := knead(200g "plain flour (12% protein)", 1/2 cup butter, milk)`
     * - two of the three inputs restate a quantity and the third does not. The
     * amount is what the line asked for, not a property of the node it targets.
     */
    const dough = recipe.recipeTrees.find(
        (node): node is SubRecipe =>
            node.kind === 'subRecipe'
            && node.outputNames.some((output) => normaliseOutputName(output) === 'dough'),
    );

    assert.ok(dough, 'expected a Dough subRecipe');
    assert.ok(isStep(dough.subTree), 'expected the subTree to be a step');

    const flour = recipe.recipeTrees.find(
        (node): node is Ingredient =>
            node.kind === 'ingredient'
            && svsToString(node.description) === 'plain flour (12% protein)',
    );

    assert.ok(flour, 'expected a plain flour ingredient');

    const milk = recipe.recipeTrees.find(
        (node): node is Ingredient =>
            node.kind === 'ingredient' && svsToString(node.description) === 'milk',
    );

    assert.ok(milk, 'expected a milk ingredient');

    const toFlour = dough.subTree.inputs.find(
        (node): node is Reference => isReference(node) && node.resolvedNode === flour,
    );

    assert.ok(toFlour, 'expected a reference resolving to the flour ingredient');

    /*
     * `200g` restated on the reference. The ingredient declares the same
     * amount, but this is the draw the step made, carried on the edge.
     */
    assert.ok(toFlour.amount, 'expected the flour reference to carry an amount');
    assert.equal(toFlour.amount.kind, 'quantity');

    const toMilk = dough.subTree.inputs.find(
        (node): node is Reference => isReference(node) && node.resolvedNode === milk,
    );

    assert.ok(toMilk, 'expected a reference resolving to the milk ingredient');

    // `milk` names the output with no amount: all of it, so nothing to carry.
    assert.equal(toMilk.amount, undefined);
});

test('a reference resolves to a labelled step, not only a := output', () => {
    const recipe = compileFixture('kitchen-sink.md');

    /*
     * `Filling := fold(whip(...), mix(red peppers, ...))` - the region nests
     * steps rather than holding a flat list, and `red peppers` names an
     * `=`-labelled step declared above. A reference targets any node, so the
     * handle a later line resolves need not be a `:=` output.
     */
    const filling = recipe.recipeTrees.find(
        (node): node is SubRecipe =>
            node.kind === 'subRecipe'
            && node.outputNames.some((output) => normaliseOutputName(output) === 'filling'),
    );

    assert.ok(filling, 'expected a Filling subRecipe');
    assert.ok(isStep(filling.subTree), 'expected the subTree to be a step');
    assert.equal(svsToString(filling.subTree.description), 'fold');

    const mix = filling.subTree.inputs.find(
        (node): node is Step => isStep(node) && svsToString(node.description) === 'mix',
    );

    assert.ok(mix, 'expected a mix step nested under fold');

    const peppers = recipe.recipeTrees.find(
        (node): node is Step => isStep(node) && node.label === 'red peppers',
    );

    assert.ok(peppers, 'expected a step labelled red peppers');

    const toPeppers = mix.inputs.find(
        (node): node is Reference => isReference(node) && node.resolvedNode === peppers,
    );

    assert.ok(toPeppers, 'expected a reference resolving to the labelled step');

    /*
     * A step has one result, so there is no output to index and the field is
     * absent rather than defaulted.
     */
    assert.equal(toPeppers.outputIndex, undefined);
});

/* --- Recipe --------------------------------------------------------------
 *
 * The entry point the rest is structured into: roots, and the frontmatter the 
 * compiler stamps on.
 */

test('the compiler stamps the resolved frontmatter onto the recipe', () => {
    const recipe: Recipe = compileFixture('kitchen-sink.md');

    /*
     * `scalingType: servings` / `base: 4` as authored. The extraction layer
     * resolves the metadata and the compiler stamps it; the DAG carries it
     * rather than the markdown layer holding it separately.
     */
    assert.equal(recipe.scalingType, 'servings');
    assert.equal(recipe.base, 4);

    /*
     * `unitSystem: imperial` as authored where a value the fixture declares rather
     * than the 'us' default, so the assertion pins the frontmatter being read
     * rather than passing on a value nothing had to produce.
     */
    assert.equal(recipe.unitSystem, 'imperial');

    /*
     * The fixture authors no slug, so the recipe takes one derived from its
     * title and always a concrete string, since a cross-file reference resolves
     * against it.
     */
    assert.equal(recipe.slug, 'kitchen-sink-test');

    /*
     * The roots the body declared. Read as a list of what is there, not a
     * count: every top-level line is a root, including the ones nothing
     * references.
     */
    assert.ok(recipe.recipeTrees.length > 0, 'expected the body to compile to roots');
});

test('a remainder marks the last draw on an ingredient, carrying no value', () => {
    const recipe = compileFixture('kitchen-sink.md');

    /*
     * `bake(mix(..., Remaining milk), 0.5 tsp of the salt)` - the main step is
     * where the chain ends, so the final draw lands here. `Dough := knead(...)`
     * already took milk without an amount; this use says what is left of it.
     */
    const bake = recipe.recipeTrees.find(
        (node): node is Step => isStep(node) && svsToString(node.description) === 'bake',
    );

    assert.ok(bake, 'expected a bake step');

    const mix = bake.inputs.find(
        (node): node is Step => isStep(node) && svsToString(node.description) === 'mix',
    );

    assert.ok(mix, 'expected a mix step under bake');

    const milk = recipe.recipeTrees.find(
        (node): node is Ingredient =>
            node.kind === 'ingredient' && svsToString(node.description) === 'milk',
    );

    assert.ok(milk, 'expected a milk ingredient');

    const toMilk = mix.inputs.find(
        (node): node is Reference => isReference(node) && node.resolvedNode === milk,
    );

    assert.ok(toMilk, 'expected a reference resolving to the milk ingredient');
    assert.ok(toMilk.amount, 'expected the milk reference to carry an amount');
    assert.equal(toMilk.amount.kind, 'remainder');

    /*
     * The wording as authored, kept for display. A remainder holds no value so
     * the ingredient list is the definitive amount, and what is left of it is a
     * validation question, not one the compiler answers.
     */
    const remainder: Remainder = toMilk.amount;

    assert.equal(remainder.wording, 'Remaining');
    assert.equal(remainder.preposition, '');

    /*
     * `0.5 tsp of the salt` - a measured draw alongside the remainder. The
     * preposition is a part following the unit, in the order authored.
     */
    const salt = recipe.recipeTrees.find(
        (node): node is Ingredient =>
            node.kind === 'ingredient' && svsToString(node.description) === 'salt',
    );

    assert.ok(salt, 'expected a salt ingredient');

    const toSalt = bake.inputs.find(
        (node): node is Reference => isReference(node) && node.resolvedNode === salt,
    );

    assert.ok(toSalt, 'expected a reference resolving to the salt ingredient');
    assert.ok(toSalt.amount, 'expected the salt reference to carry an amount');
    assert.equal(toSalt.amount.kind, 'quantity');

    const [unit, preposition] = toSalt.amount.parts;

    assert.equal(unit.text, 'tsp');
    assert.equal(unit.leading, ' ');

    /*
     * The preposition holds its own words; the space before it is what preceded
     * the part, not text the part carries.
     */
    assert.equal(preposition.text, 'of the');
    assert.equal(preposition.leading, ' ');
});
