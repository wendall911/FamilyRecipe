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

import { compileString, normaliseOutputName, svsToString } from './recipe-model.ts';

/** A named sub-recipe output, so later references can resolve to its SubRecipe. */
interface NamedOutput {
  subRecipe: SubRecipe;
  outputIndex: number;
}

class RecipeCompiler {
  /** Known output names → their SubRecipe output, keyed by normalised name. */
  private namedOutputs = new Map<string, NamedOutput>();

  compile(ast: AstRecipe): Recipe {
    this.namedOutputs = new Map();
    return {
      recipeTrees: ast.stmts.map((stmt) => this.compileStmt(stmt)),
      follows: null,
      // Scaling comes from frontmatter (markdown.ts); index.ts merges the
      // extracted RecipeScaling when wiring. Default = a frontmatter-less recipe.
      scalingType: 'fixed',
      base: 1,
    };
  }

  /**
   * Compile a statement into a recipe tree node. A `:=` statement (stmt.named)
   * is a sub-recipe heading: its tree is wrapped in a SubRecipe with
   * hasHeading. Every other statement — an `=` output or a bare line — is the
   * node the expression already compiled to (an ingredient or step).
   */
  private compileStmt(stmt: AstStmt): RecipeTreeNode {
    const tree = this.compileExpr(stmt.expr);

    if (!stmt.named) return tree;

    const outputNames = (stmt.outputs ?? []).map((o) => compileString(o));

    const subRecipe: SubRecipe = {
      kind: 'subRecipe',
      subTree: tree,
      outputNames,
      hasHeading: true,
    };

    outputNames.forEach((outputName, outputIndex) => {
      this.namedOutputs.set(normaliseOutputName(outputName), { subRecipe, outputIndex });
    });

    return subRecipe;
  }

  /** Compile any expression node, recursing through nested steps and inputs. */
  private compileExpr(expr: AstExpr): Step | Reference | Ingredient {
    if (expr.kind === 'step') return this.compileStep(expr);
    return this.compileReference(expr);
  }

  private compileStep(step: AstStep): Step {
    return {
      kind: 'step',
      description: compileString(step.name),
      inputs: step.inputs.map((input) => this.compileExpr(input)),
    };
  }

  /** A name matching an earlier output is a Reference; otherwise an Ingredient. */
  private compileReference(ref: AstReference): Reference | Ingredient {
    const name = compileString(ref.name);
    const named = this.namedOutputs.get(normaliseOutputName(name));

    if (named !== undefined) {
      return {
        kind: 'reference',
        subRecipe: named.subRecipe,
        outputIndex: named.outputIndex,
        amount: this.compileAmount(ref.amount),
      };
    }

    // A bare ingredient's amount is a quantity or nothing. A `remainder`
    // ("use the rest") carries no numeric value — it is a readable label, never
    // exposed as a quantity — so it leaves the ingredient quantity-less.
    return {
      kind: 'ingredient',
      description: name,
      quantity: ref.amount?.kind === 'quantity' ? this.compileQuantity(ref.amount) : null,
    };
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
export function compile(ast: AstRecipe): Recipe {
  return new RecipeCompiler().compile(ast);
}
