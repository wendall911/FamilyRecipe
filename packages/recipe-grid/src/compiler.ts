/**
 * Compiler - transcribes a parsed recipe (the grammar AST, `ast.ts`) into the
 * `model.ts` `Recipe` DAG the renderer consumes. One file is one recipe:
 * `compile(ast)` returns a single `Recipe` whose `recipeTrees` are the roots of
 * its one connected graph.
 *
 * Structure comes straight across: every structural value is already present in
 * the AST. Two things are resolved here, not transcribed:
 *   - per named reference, whether it points at an earlier sub-recipe output
 *     (a Reference) or is a plain Ingredient;
 *   - per quantity part, the canonical unit key its authored text resolves to
 *     (`unitOfMeasureID`, via `recipe-model.ts`).
 */

import type {
    Amount,
    Ingredient,
    Quantity,
    QuantityPart,
    Recipe,
    RecipeMeta,
    RecipeReference,
    RecipeTreeNode,
    Reference,
    Step,
    SubRecipe,
} from './model.ts';

import type {
    ExternalReference as AstExternalReference,
    Expr as AstExpr,
    Quantity as AstQuantity,
    Recipe as AstRecipe,
    Reference as AstReference,
    Stmt as AstStmt,
    Step as AstStep,
} from './ast.ts';

import {
    compileString,
    normaliseOutputName,
    svsNormalize,
    svsToString,
    unitOfMeasureID,
} from './recipe-model.ts';

/**
 * A resolvable name and the node a later reference resolves to. Covers both `:=`
 * sub-recipe outputs (which carry an outputIndex) and `=` ingredient/step labels
 * (a single node, no index).
 */
interface NamedNode {
    resolvedNode: RecipeTreeNode;
    outputIndex?: number;
}

/**
 * Descend a chain of single-input steps to its sole ingredient. Returns null if
 * the chain branches (a step with more than one input) or bottoms out in a
 * non-ingredient. Used to name a bare `ingredient, action` line by the
 * ingredient it wraps.
 */
function innermostIngredient(node: RecipeTreeNode): Ingredient | null {
    if (node.kind === 'ingredient') {
        return node;
    }
    else if (node.kind === 'step' && node.inputs.length === 1) {
        return innermostIngredient(node.inputs[0]);
    }

    return null;
}

class RecipeCompiler {
    /**
     * Known names (`:=` outputs and `=` labels) mapped to their node, keyed by normalised name.
     */
    private namedNodes = new Map<string, NamedNode>();

    compile(ast: AstRecipe, meta: RecipeMeta): Recipe {
        this.namedNodes = new Map();

        return {
            recipeTrees: ast.stmts.map((stmt) => this.compileStmt(stmt)),
            /*
             * Recipe-level metadata (from the YAML frontmatter, resolved by
             * markdown.ts) is recipe data and belongs on the Recipe; the compiler
             * stamps whatever RecipeMeta it is handed. Resolving default vs.
             * configured values is the extraction layer's job, not the compiler's.
             */
            slug: meta.slug,
            scalingType: meta.scalingType,
            base: meta.base,
            unitSystem: meta.unitSystem,
        };
    }

    /**
     * Compile a statement into a recipe tree node, registering any name it
     * declares (a `:=` output or an `=` label) for later references to resolve to.
     *
     * Names are registered after the statement compiles, so resolution is
     * backward-only: a later line can reference this name, an earlier one cannot.
     */
    private compileStmt(stmt: AstStmt): RecipeTreeNode {
        const tree = this.compileExpr(stmt.expr);

        /*
         * A recipeReference is a self-contained outward link: it renders as its
         * own <a> and is never a name target or a back-edge, so it skips the
         * name-registration ladder below and returns as its own root.
         *
         * The guard tests `stmt.expr.kind`, not `tree.kind`, to narrow `stmt.expr`:
         * that is what lets the `stmt.expr.label` access below type-check, since an
         * `externalReference` has no `label`.
         */
        if (stmt.expr.kind === 'externalReference') {
            return tree;
        }
        else if (stmt.named) {
            const outputNames = (stmt.outputs ?? []).map((o) => compileString(o));

            const subRecipe: SubRecipe = {
                kind: 'subRecipe',
                subTree: tree,
                outputNames,
            };

            outputNames.forEach((outputName, outputIndex) => {
                this.namedNodes.set(
                    normaliseOutputName(outputName),
                    {
                        resolvedNode: subRecipe,
                        outputIndex,
                    },
                );
            });

            return subRecipe;
        }

        /*
         * `=` label (if any) was threaded onto the node by compileExpr; register
         * it as a resolvable target pointing at the node itself.
         */
        if (stmt.expr.label !== undefined) {
            this.namedNodes.set(
                normaliseOutputName(compileString(stmt.expr.label)),
                {
                    resolvedNode: tree,
                },
            );
        }
        else if (tree.kind === 'ingredient') {
            /*
             * A bare ingredient declaration (`2 tsp honey`) registers by its
             * description, so a later reference to `honey` resolves to this node
             * and picks up its quantity. An unreferenced declaration just stays a
             * root of its own.
             */
            this.namedNodes.set(
                normaliseOutputName(tree.description),
                {
                    resolvedNode: tree,
                },
            );
        }
        else if (tree.kind === 'step') {
            /*
             * A bare `ingredient, action` line (e.g. `2 cloves garlic, crushed`)
             * has no `=` label, but a later line still references it by the
             * ingredient's name (`garlic`). Register the innermost ingredient's
             * description against the whole step chain so the reference resolves to
             * the full body. Only a single-input chain ending in one ingredient has
             * an unambiguous name; anything else registers nothing.
             */
            const inner = innermostIngredient(tree);

            if (inner !== null) {
                this.namedNodes.set(
                    normaliseOutputName(inner.description),
                    {
                        resolvedNode: tree,
                    },
                );
            }
        }

        return tree;
    }

    /**
     * Compile any expression node, recursing through nested steps and inputs.
     */
    private compileExpr(expr: AstExpr): Step | Reference | Ingredient | RecipeReference {
        if (expr.kind === 'step') {
            return this.compileStep(expr);
        }
        else if (expr.kind === 'externalReference') {
            return this.compileExternalReference(expr);
        }

        return this.compileReference(expr);
    }

    /**
     * A cross-file link (`[Dough](pizza-dough "...")`) lowers to a standalone
     * RecipeReference leaf, carrying name, targetSlug, and title straight through
     * for the render side to emit as an `<a>`. Whether the slug resolves (a live
     * recipe or a 404) is a site/index concern, not the compiler's; a dangling
     * link is still a valid DAG.
     * 
     * The link can have an optional authored amount that is a RecipeNumber so
     * there is a scalable value for the recipe here.
     */
    private compileExternalReference(ref: AstExternalReference): RecipeReference {
        const node: RecipeReference = {
            kind: 'recipeReference',
            name: ref.name,
            targetSlug: ref.targetSlug,
        };

        if (ref.title !== undefined) {
            node.title = ref.title;
        }

        if (ref.amount !== undefined) {
            node.amount = ref.amount;
        }

        return node;
    }

    private compileStep(step: AstStep): Step {
        const compiled: Step = {
            kind: 'step',
            description: compileString(step.name),
            inputs: step.inputs.map((input) => this.compileExpr(input)),
        };

        if (step.label !== undefined) {
            compiled.label = svsToString(compileString(step.label));
        }

        return compiled;
    }

    /**
     * A name matching an earlier registered name (a `:=` output or an `=` label)
     * is a Reference back-pointer to that node; otherwise it is an Ingredient.
     */
    private compileReference(ref: AstReference): Reference | Ingredient {
        const name = compileString(ref.name);
        const named = this.namedNodes.get(normaliseOutputName(name));

        if (named !== undefined) {
            const reference: Reference = {
                kind: 'reference',
                resolvedNode: named.resolvedNode,
                amount: this.compileAmount(ref.amount),
            };

            // outputIndex only applies to a multi-output SubRecipe target.
            if (named.outputIndex !== undefined) {
                reference.outputIndex = named.outputIndex;
            }

            return reference;
        }

        /*
         * A bare ingredient (no matching name). A `remainder` ("use the rest")
         * carries no numeric amount, so its wording folds into the description and
         * the ingredient stays quantity-less.
         */
        const description =
            ref.amount?.kind === 'remainder'
                ? svsNormalize([ref.amount.wording, ' ', ...name])
                : name;
        const ingredient: Ingredient = {
            kind: 'ingredient',
            description,
            quantity: ref.amount?.kind === 'quantity' ? this.compileQuantity(ref.amount) : null,
        };

        /*
         * An `=`-labelled ingredient carries its label (the handle later lines
         * reference); it is registered in namedNodes and also stored on the node.
         */
        if (ref.label !== undefined) {
            ingredient.label = svsToString(compileString(ref.label));
        }

        return ingredient;
    }

    /**
     * An absent amount ("use X") means all of X; the ingredient list holds the total.
     */
    private compileAmount(amount: AstReference['amount']): Amount | undefined {
        if (amount === null) {
            return undefined;
        }
        else if (amount.kind === 'remainder') {
            return {
                kind: 'remainder',
                wording: amount.wording,
                preposition: amount.preposition,
            };
        }

        return this.compileQuantity(amount);
    }

    /**
     * A quantity's parts come straight across, each flattened to its authored
     * text. Every part is asked whether the vocabulary claims it, which is the
     * only thing known about a part here; the canonical key rides on the
     * quantity. A quantity whose author wrote more than one unit carries the
     * last -- what they wrote, not a choice made here.
     *
     */
    private compileQuantity(quantity: AstQuantity): Quantity {
        let uomID: string | null = null;
        const parts: QuantityPart[] = quantity.parts.map((part) => {
            const text = svsToString(compileString(part.text));
            const partUomID = unitOfMeasureID(text);

            if (partUomID !== null) {
                uomID = partUomID;
            }

            return {
                kind: 'quantityPart',
                leading: part.leading,
                text,
                isUnitName: partUomID !== null
            };
        });

        return {
            kind: 'quantity',
            value: quantity.value,
            parts,
            unitOfMeasureID: uomID,
        };
    }
}

/**
 * Compile one parsed recipe (a grammar AST `Recipe`) into a `model.ts` `Recipe`.
 * One file is one recipe; parsing is the caller's concern, this consumes AST.
 */
export function compile(ast: AstRecipe, meta: RecipeMeta): Recipe {
    return new RecipeCompiler().compile(ast, meta);
}
