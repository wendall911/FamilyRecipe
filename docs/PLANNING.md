# Goal
Goal is to make a family recipe book with a very simple table layout.

## Examples
 - https://cookbook.cstebbins.com/
   - Uses unknown/private svelte parser with a bunch of nested divs for layout
 - https://recipes.18sg.net/index.html
   - Uses https://github.com/mossblaser/recipe_grid parser
     - Python
     - Custom MD format called Recipe Grid 2
     - Uses some oldskool \<table\> layout renderer
     - Has good example parsing script for pulling from a committed directory:
       - https://github.com/18sg/recipes/blob/master/scripts/add_recent_recipes_to_readme.py
     - Documentation: https://mossblaser.github.io/recipe_grid/

Example:
```
Tiffin
======

A delicious, chocolatey treat.

    6 tsp of cocoa powder
    2 tbsp of golden syrup
    1/2 cup of butter
    1/2 cup of sugar
    16oz of digestives
    200g of chocolate
    
    cover(
        mix(
            heat until bubbling (cocoa powder, golden syrup, butter, sugar),
            crush(digestives)
        ),
        melt(chocolate)
    )
```
![Tiffin](https://github.com/mossblaser/recipe_grid/blob/main/docs/source/_static/tiffin_example.png)

 - https://github.com/TheSonOfThomp/recipe-parser
   - Unknown if the parser works correctly
   - Written in TypeScript
   - Uses a custom MD that doesn't look as flexible as Recipe Grid 2

Example:

```
Kraft Dinner
[1] Boil: 6 cups water
[2] Cook for 6 minutes: #1, macaroni
[3] Drain: #2
[4] Stir: 
    #3, 
    1/4 cup butter, 
    1/4 cup milk, 
    powdered cheese
```
![kd-example](https://github.com/TheSonOfThomp/recipe-parser/blob/master/kd-example.png)

## The Plan
  1. Utilize Recipe Grid 2 MD format and recipe_grid Python parser to generate html recipes
     1. Needs custom renderer to output html layout and data for recipe as Svelte Components
  1. Use Svelte to generate static website for publishing.
     1. Create Svelte Recipe component
        1. Read in staticly generated components automatically.
           1. One compoenent file per recipe. html layout and data (svelte component)
           1. recipe_grid parser generates a separate directory for all conversions. In our case, this will be dynamic.
        1. Utilize Redux in Svelte for state management. Yes, overkill, but whatever.
           1. See https://svelte.dev/docs/svelte/svelte-options about enabling and utilizing Runes
     1. Generate index based on all recipes rendered. Iterate over imported components, and use `getContext` to extract needed data from the Recipe Component.
  1. Use github actions to generate site. Both Python and Node.

### Include HTML generated recipe chunks in page.
```
<div>
  {#include 'path/to/external/html/file.html'}
    <!-- contents of the included HTML file -->
  {/include}
</div>
```

Utilize something like this to render the Svelte components:
From https://stackoverflow.com/questions/78955169/display-all-svelte-components-in-a-folder

```
<script lang="ts">
    import type { ComponentType } from 'svelte';

    const icons: Record<string, { default: ComponentType }> =
        import.meta.glob('$lib/icons/*.svelte', { eager: true });
</script>

{#each Object.values(icons) as { default: Icon }}
    <Icon />
{/each}
```

Alternatively: https://stackoverflow.com/questions/72579031/how-to-fetch-data-inside-sveltekit-component-that-is-not-a-page

Pull in data from generated Svelte component:
```
<!-- Child component (Recipe.svelte) -->
<script>
  import { getContext } from 'svelte';
  let recipe = getContext('recipe');
</script>

<h1>{recipe.title}</h1>
```

Send data to component (for conversions):
```
<!-- Parent component (App.svelte) -->
<script>
    import { setContext } from 'svelte';
    let ingredients = {
        sugar: '1tbsp'
    };
    setContext('ingredients', ingredients);
</script>
```

## Run job both Node and Python
```
name: Build and Test

jobs:
  python:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v2
      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.10'
      - name: Install dependencies
        run: pip install -r requirements.txt
      - name: Run tests
        run: python -m unittest discover tests/

  node:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v2
      - name: Set up Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '16'
      - name: Install dependencies
        run: npm install
      - name: Run tests
        run: npm test
```

## Card Layout
- https://flexboxfroggy.com/
- https://www.joshwcomeau.com/css/interactive-guide-to-flexbox/
