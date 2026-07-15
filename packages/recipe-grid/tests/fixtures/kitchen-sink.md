---
scalingType: servings
base: 4
---
Kitchen Sink Test
=================

A contrived, not-real recipe. It exists only to push a pile of awkward-but-real
constructs (drawn from the Grid 2 corpus) through the parser so tests can pin
down how each is handled. Do not cook this.

    200g "plain flour (12% protein)"
    1 'mixed veg (e.g. carrots, peas)'
    {1 handful} fresh parsley, chopped
    2 large eggs
    1/2 cup butter
    0.5 tsp salt
    3 cloves garlic
    150ml milk
    100ml cream
    2 tbsp sugar
    red peppers = 150g roasted red peppers from jar, finely chopped

    Dough := knead(
      200g "plain flour (12% protein)",
      1/2 cup butter,
      milk
    )

    bake(
      mix(
        dough,
        {1 handful} fresh parsley,
        Remaining milk
      ),
      0.5 tsp of the salt
    )

    Filling := fold(
      whip(
        cream,
        2 tbsp sugar
      ),
      mix(
        red peppers,
        Remaining butter
      )
    )
