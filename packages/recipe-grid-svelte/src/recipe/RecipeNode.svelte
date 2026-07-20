<script lang="ts">
    import type { StructureNode } from '@wendall911/recipe-grid';
    import { PART_ATTRS } from '@wendall911/recipe-grid/parts';

    import Root from './Root.svelte';
    import Grid from './Grid.svelte';
    import Ingredient from './Ingredient.svelte';
    import Step from './Step.svelte';
    import Inputs from './Inputs.svelte';
    import SubRecipe from './SubRecipe.svelte';
    import SubRecipeHeader from './SubRecipeHeader.svelte';
    import Reference from './Reference.svelte';
    import RecipeReference from './RecipeReference.svelte';
    import Quantity from './Quantity.svelte';
    import ScaledValue from './ScaledValue.svelte';

    /*
     * The dispatch seam of a thin wrapper over recipe-grid's set API. recipe-grid
     * already defines every part and emits the complete element as a structure
     * node (its tag, data-* markers, attrs, and text). This binding invents no
     * DOM: it maps a node's part to that part's component (named by the core's
     * part naming schema, e.g. `data-recipe-grid-sub-recipe` -> SubRecipe) so
     * each part is a discoverable file in the tree, and each component reflects
     * its node from the node's own data, recursing part-children through here.
     *
     * Plain nodes (a `<p>` or literal `<span>` with no part) are the interior of
     * the part node that owns them, reflected there; a node without a `part`
     * never reaches a case here.
     */
    let { node }: { node: StructureNode } = $props();

    // The component for each part marker, keyed by the full `data-recipe-grid-*`
    // attribute a node carries in `node.part`.
    const COMPONENT_FOR_PART: Record<string, typeof Root> = {
        [PART_ATTRS.root]: Root,
        [PART_ATTRS.grid]: Grid,
        [PART_ATTRS.ingredient]: Ingredient,
        [PART_ATTRS.step]: Step,
        [PART_ATTRS.inputs]: Inputs,
        [PART_ATTRS['sub-recipe']]: SubRecipe,
        [PART_ATTRS['sub-recipe-header']]: SubRecipeHeader,
        [PART_ATTRS.reference]: Reference,
        [PART_ATTRS['recipe-reference']]: RecipeReference,
        [PART_ATTRS.quantity]: Quantity,
        [PART_ATTRS['scaled-value']]: ScaledValue,
    };

    const Component = node.part !== undefined ? COMPONENT_FOR_PART[node.part] : undefined;
</script>

{#if Component}
    <Component {node} />
{/if}
