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
