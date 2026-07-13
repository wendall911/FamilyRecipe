<script lang="ts">
  import { getRecipeContext } from './context';

  // Model-driven: the Grid walks the model and emits the table structure.
  // The consumer does NOT compose the interior blocks — structure comes from data.
  const ctx = getRecipeContext();

  // Placeholder: the model is currently a passthrough stub ({ title, source }),
  // so the body renders the raw source. When parse() produces a real recipe
  // tree, this recurses the tree into data-recipe-grid-* nodes in the same
  // container — structure extends, it is not replaced.
</script>

<div data-recipe-grid>
  <div data-recipe-grid-body>{ctx.model.source}</div>
</div>
