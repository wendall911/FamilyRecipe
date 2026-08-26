/**
 * The compiler transcribes a parsed recipe (the grammar AST, `ast.ts`) into the
 * `model.ts` `Recipe` DAG.
 * 
 * `compile(ast)` returns a single `Recipe` whose `recipeTrees` are the roots of
 * its one connected graph.
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
    normalizeOutputName,
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
     * Known names (`:=` outputs and `=` labels) mapped to their node,
     * keyed by normalised name.
     */
    private namedNodes = new Map<string, NamedNode>();

    compile(ast: AstRecipe, meta: RecipeMeta): Recipe {
        this.namedNodes = new Map();

        return {
            recipeTrees: ast.stmts.map((stmt) => this.compileStmt(stmt)),
            /*
             * Recipe-level metadata (from the YAML frontmatter, resolved by
             * markdown.ts) is recipe data and belongs on the Recipe; the compiler
             * stamps whatever RecipeMeta it is handed.
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
        let subRecipe: SubRecipe | undefined;
        let normalizedName;

        if (stmt.expr.kind !== 'externalReference') {
            if (stmt.heading) {
                subRecipe = {
                    kind: 'subRecipe',
                    subTree: tree,
                    heading: svsToString(compileString(stmt.heading)),
                };

                normalizedName = normalizeOutputName(compileString(stmt.heading));
            }
            else if (stmt.expr.label !== undefined) {
                normalizedName = normalizeOutputName(compileString(stmt.expr.label));
            }
            else if (tree.kind === 'ingredient') {
                normalizedName = normalizeOutputName(tree.description);
            }
            else if (tree.kind === 'step') {
                const inner = innermostIngredient(tree);

                if (inner !== null) {
                    normalizedName = normalizeOutputName(inner.description);
                }
            }

            if (normalizedName) {
                this.namedNodes.set(
                    normalizedName,
                    {
                        resolvedNode: subRecipe ? subRecipe : tree,
                    },
                );
            }
        }

        return subRecipe ? subRecipe : tree;
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
     * The link can have an optional authored `Amount` so there is a scalable
     * value for the external recipe.
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
            node.amount = this.compileAmount(ref.amount);
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
        const named = this.namedNodes.get(normalizeOutputName(name));

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
         * carries no numeric amount.
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
     * A quantity's and it's authored parts.
     */
    private compileQuantity(quantity: AstQuantity): Quantity {
        let uomID: string | null = null;
        const parts: QuantityPart[] = quantity.parts.map((part) => {
            const text = svsToString(compileString(part.text));
            const partUomID = unitOfMeasureID(text);

            // If the part is an identifiable uom, set the part uom id
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
 * Compile parsed recipe (a grammar AST `Recipe`) into a `model.ts` `Recipe`.
 */
export function compile(ast: AstRecipe, meta: RecipeMeta): Recipe {
    return new RecipeCompiler().compile(ast, meta);
}
