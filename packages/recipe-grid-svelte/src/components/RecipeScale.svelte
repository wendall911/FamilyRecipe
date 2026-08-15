<script lang="ts">
    import { getContext, setContext } from 'svelte';
    import type { RecipeContext } from '../recipe.js';
    import {
        RecipeScaleError,
        ScaleContext,
        type OnScaleChangeFn,
        type ScaleOption,
    } from '../scaling.js';

    let { title, options, onValueChange }: {
        title: string;
        options: ScaleOption[];
        onValueChange?: OnScaleChangeFn<number>;
    } = $props();

    // svelte-ignore state_referenced_locally
    const recipeScale = new ScaleContext(title, options, onValueChange);
    const recipe = getContext<RecipeContext>('recipe');

    if (typeof recipeScale.title !== 'string' || recipeScale.title.trim() === '') {
        throw new RecipeScaleError('`title` must be a non-empty string.');
    }

    if (!Array.isArray(recipeScale.options) || recipeScale.options.length === 0) {
        throw new RecipeScaleError('`options` must be a non-empty array.');
    }

    for (const ScaleOption of recipeScale.options) {
        if (typeof ScaleOption?.value !== 'number' || Number.isNaN(ScaleOption.value)) {
            throw new RecipeScaleError('Every option needs a numeric `value`.');
        }

        if (typeof ScaleOption?.label !== 'string' || ScaleOption.label.trim() === '') {
            throw new RecipeScaleError(
                `Option ${ScaleOption.value} needs a non-empty \`label\`.`,
            );
        }
    }

    if (new Set(recipeScale.options.map((option) => option.value)).size !== recipeScale.options.length) {
        throw new RecipeScaleError('Option `value`s must be unique.');
    }

    if (recipeScale.onValueChange != null && typeof recipeScale.onValueChange !== 'function') {
        throw new RecipeScaleError('`onValueChange` must be a function.');
    }

    setContext('recipe-scale', recipeScale);
</script>

{#if recipe.parsed.meta.scalingType === 'servings'}
    <fieldset>
        <legend>{recipeScale.title}</legend>{#each recipeScale.options as { value, label } (value)}
            <label>
                <input
                    type="radio"
                    name={`recipe-grid-scale-${recipe.parsed.meta.slug}`}
                    {value}
                    checked={value === 1}
                    onchange={() => onValueChange?.(value)}
                />{@html label}
            </label>
        {/each}
    </fieldset>
{/if}
