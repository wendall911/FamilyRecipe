<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { RecipeModel } from '@wendall911/recipe-grid';
  import { setRecipeContext } from './context';

  let { model, children }: { model: RecipeModel; children?: Snippet } = $props();

  // Reactive serving multiplier, set by <Recipe.Servings>, consumed by <Recipe.Grid>.
  let scale = $state(1);

  // Provide the shared context. `model` is passed through; `scale` stays reactive
  // via the getter so consumers see live updates.
  setRecipeContext({
    model,
    get scale() {
      return scale;
    },
    set scale(v: number) {
      scale = v;
    },
  });
</script>

<div data-recipe-grid-root>
  {@render children?.()}
</div>
