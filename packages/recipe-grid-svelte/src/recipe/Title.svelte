<script lang="ts">
  import { getRecipeContext } from './context';

  // The title is recipe *data* (model.title), exposed as an optional named part
  // so the consumer can place or omit it. Data-bound, not chrome.
  const ctx = getRecipeContext();
</script>

{#if ctx.model.title}
  <div data-recipe-grid-title>{ctx.model.title}</div>
{/if}
