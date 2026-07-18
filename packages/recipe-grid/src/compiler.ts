/**
 * Compiler — transcribes a parsed recipe (the grammar AST, `ast.ts`) into the
 * `model.ts` `Recipe` DAG the renderer consumes. One file is one recipe:
 * `compile(ast)` returns a single `Recipe` whose `recipeTrees` are the roots of
 * its one connected graph.
 *
 * This is a straight structural mapping. Every value is already present in the
 * AST; the only resolution is deciding, per named reference, whether it points
 * at an earlier sub-recipe output (a Reference) or is a plain Ingredient.
 */

import type {
  Amount,
  Ingredient,
  Quantity,
  Recipe,
  RecipeMeta,
  RecipeTreeNode,
  Reference,
  Step,
  SubRecipe,
} from './model.ts';

import type {
  Expr as AstExpr,
  Quantity as AstQuantity,
  Recipe as AstRecipe,
  Reference as AstReference,
  Stmt as AstStmt,
  Step as AstStep,
} from './ast.ts';

import { compileString, normaliseOutputName, svsNormalize, svsToString } from './recipe-model.ts';

/**
 * A resolvable name → the node a later reference resolves to. Covers both `:=`
 * sub-recipe outputs (with an outputIndex) and `=` ingredient/step labels (a
 * single node, no index).
 */
interface NamedNode {
  resolvedNode: RecipeTreeNode;
  outputIndex?: number;
}

/**
 * Descend a chain of single-input steps to its sole ingredient, or null if the
 * chain branches (a step with ≠1 inputs) or bottoms out in a non-ingredient.
 * Used to name a bare `ingredient, action` line by the ingredient it wraps.
 */
function innermostIngredient(node: RecipeTreeNode): Ingredient | null {
  if (node.kind === 'ingredient') return node;
  if (node.kind === 'step' && node.inputs.length === 1) {
    return innermostIngredient(node.inputs[0]);
  }
  return null;
}

class RecipeCompiler {
  /** Known names (`:=` outputs and `=` labels) → their node, by normalised name. */
  private namedNodes = new Map<string, NamedNode>();

  compile(ast: AstRecipe, meta: RecipeMeta): Recipe {
    this.namedNodes = new Map();
    return {
      recipeTrees: ast.stmts.map((stmt) => this.compileStmt(stmt)),
      follows: null,
      // Recipe-level metadata (from the YAML frontmatter, resolved by
      // markdown.ts) is recipe data and belongs on the Recipe; the compiler
      // stamps whatever RecipeMeta it is handed. Resolving default vs.
      // configured values is the extraction layer's job, not the compiler's.
      slug: meta.slug,
      scalingType: meta.scalingType,
      base: meta.base,
    };
  }

  /**
   * Compile a statement into a recipe tree node.
   *
   * A `:=` statement (stmt.named) is a sub-recipe heading: its tree is wrapped
   * in a SubRecipe, and each output name registers a resolvable reference
   * target (with its outputIndex).
   *
   * An `=` statement carries a single label on its expression (threaded onto the
   * compiled node by compileExpr); the label registers the node itself as a
   * resolvable target. A bare line registers nothing.
   *
   * Names are registered AFTER the statement compiles, so resolution stays
   * backward-only (a later line can reference this name; an earlier one cannot).
   */
  private compileStmt(stmt: AstStmt): RecipeTreeNode {
    const tree = this.compileExpr(stmt.expr);

    if (stmt.named) {
      const outputNames = (stmt.outputs ?? []).map((o) => compileString(o));

      const subRecipe: SubRecipe = {
        kind: 'subRecipe',
        subTree: tree,
        outputNames,
      };

      outputNames.forEach((outputName, outputIndex) => {
        this.namedNodes.set(normaliseOutputName(outputName), {
          resolvedNode: subRecipe,
          outputIndex,
        });
      });

      return subRecipe;
    }

    // `=` label (if any) was threaded onto the node by compileExpr; register it
    // as a resolvable target pointing at the node itself.
    if (stmt.expr.label !== undefined) {
      this.namedNodes.set(normaliseOutputName(compileString(stmt.expr.label)), {
        resolvedNode: tree,
      });
    } else if (tree.kind === 'ingredient') {
      // A bare ingredient-list declaration (`2 tsp honey`) registers by its
      // description so a later step referencing `honey` resolves to THIS node —
      // which carries the quantity. The ingredient then renders once, at its
      // use site, with its amount (matching the recipe grid: each ingredient
      // appears exactly once, where it is used). A declaration that is never
      // referenced simply stays a root of its own.
      this.namedNodes.set(normaliseOutputName(tree.description), { resolvedNode: tree });
    } else if (tree.kind === 'step') {
      // A bare `ingredient, action` line (e.g. `2 cloves garlic, crushed`)
      // compiles to a chain of single-input steps bottoming out in one
      // ingredient. It carries no `=` label, but a later line still references
      // it by that ingredient's name (`garlic`). Register the innermost
      // ingredient's description → the WHOLE step chain, so the reference
      // resolves to the full body (like an `=`-labelled step does), rendering
      // once at its use site. Only a single-input chain ending in one
      // ingredient has an unambiguous name; anything else registers nothing.
      const inner = innermostIngredient(tree);
      if (inner !== null) {
        this.namedNodes.set(normaliseOutputName(inner.description), { resolvedNode: tree });
      }
    }

    return tree;
  }

  /** Compile any expression node, recursing through nested steps and inputs. */
  private compileExpr(expr: AstExpr): Step | Reference | Ingredient {
    if (expr.kind === 'step') return this.compileStep(expr);
    return this.compileReference(expr);
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

    // A bare ingredient (no matching name). Its amount is a quantity or nothing.
    // A `remainder` ("use the rest") carries no numeric amount — it is display
    // text only (no back-reference, no traversal; that is a validator concern),
    // so its wording is folded into the description and the ingredient stays
    // quantity-less.
    const description =
      ref.amount?.kind === 'remainder'
        ? svsNormalize([ref.amount.wording, ' ', ...name])
        : name;
    const ingredient: Ingredient = {
      kind: 'ingredient',
      description,
      quantity: ref.amount?.kind === 'quantity' ? this.compileQuantity(ref.amount) : null,
    };
    // An `=`-labelled ingredient carries its label (the handle later lines
    // reference); it is registered in namedNodes and also stored on the node.
    if (ref.label !== undefined) {
      ingredient.label = svsToString(compileString(ref.label));
    }
    return ingredient;
  }

  /** An absent amount ("use X") means all of X; the ingredient list holds the total. */
  private compileAmount(amount: AstReference['amount']): Amount | undefined {
    if (amount === null) return undefined;
    if (amount.kind === 'remainder') {
      return { kind: 'remainder', wording: amount.wording, preposition: amount.preposition };
    }
    return this.compileQuantity(amount);
  }

  private compileQuantity(quantity: AstQuantity): Quantity {
    return {
      kind: 'quantity',
      value: quantity.value,
      unit: quantity.unit !== null ? svsToString(compileString(quantity.unit)) : null,
      valueUnitSpacing: quantity.valueUnitSpacing,
      preposition: quantity.preposition,
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
