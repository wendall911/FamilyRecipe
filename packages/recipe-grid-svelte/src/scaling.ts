/*
 * One scale on offer, and the text that labels it.
 */
export type ScaleOption = {
    value: number;
    label: string;
};

/*
 * Called with the picked scale. What happens next is the consumer's.
 */
export type OnScaleChangeFn<T> = (value: T) => void;

/*
 * What `Recipe.Scale` was given, carried to the parts beneath it.
 */
export class ScaleContext {

    title: string;

    options: ScaleOption[];

    onValueChange?: OnScaleChangeFn<number>;

    constructor(
        title: string,
        options: ScaleOption[],
        onValueChange?: OnScaleChangeFn<number>,
    ) {
        this.title = title;
        this.options = options;
        this.onValueChange = onValueChange;
    }

}

/*
 * Thrown when the control cannot be drawn with labels. Not a broken recipe.
 */
export class RecipeScaleError extends Error {

    constructor(message: string) {
        super(message);
        this.name = 'RecipeScaleError';
    }

}
