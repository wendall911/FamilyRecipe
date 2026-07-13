<script lang="ts">
  import { getRecipeContext } from './context';

  // Decoration: a control that computes a scale factor and passes it to the Grid
  // via context. It holds no recipe data of its own. Optional, consumer-placed.
  const ctx = getRecipeContext();

  const multipliers = [
    { label: '½X', value: 0.5 },
    { label: '1X', value: 1 },
    { label: '2X', value: 2 },
  ];

  function setScale(value: number): void {
    ctx.scale = value;
  }
</script>

<div data-recipe-grid-servings>
  <input
    data-recipe-grid-servings-input
    type="number"
    min="1"
    value={ctx.scale}
    oninput={(e) => setScale(Number(e.currentTarget.value))}
  />
  {#each multipliers as m (m.value)}
    <button
      type="button"
      data-recipe-grid-servings-multiplier
      data-active={ctx.scale === m.value ? '' : undefined}
      onclick={() => setScale(m.value)}
    >
      {m.label}
    </button>
  {/each}
</div>
