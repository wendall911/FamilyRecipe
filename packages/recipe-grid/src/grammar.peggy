/*
 * Recipe Grid grammar — Peggy port of recipe_grid's parser/grammar.peg.
 *
 * Structure and rule set follow the canonical grammar.peg (mossblaser's
 * recipe_grid, consumed there by the `peggie` PEG engine). Peggy notation
 * differs from peggie: `=` instead of `<-`, character classes / regex literals
 * instead of peggie's `r"..."` regex terminals. Semantics are intentionally
 * absent — this is Stage 1: the grammar produces Peggy's raw parse tree only.
 * The AST transform (ast.py port) and compiler (compiler.py port) are later
 * stages.
 *
 * @KNOWN_UNITS@ in the canonical grammar is substituted at compile time with a
 * regex of all known units. That substitution is not wired yet; `known_unit`
 * is a placeholder that matches nothing until the units list is ported.
 */

{{
import { Fraction } from 'fraction.js';
}}

Recipe
  = sp? stmts:stmt+ eof {
      return { kind: 'recipe', offset: stmts[0].offset, stmts };
    }

/*
 * `:=` and `=` are distinct constructs, caught separately:
 *   `:=`  sub_recipe_heading — names a sub-recipe (one or more outputs).
 *   `=`   ingredient_label   — a single label on the statement's node.
 * A statement is a `:=` heading, OR carries a `=` label, OR neither; the two
 * optionals are independent (never an alternation), so they cannot conflate.
 */
stmt
  = heading:sub_recipe_heading?
    label:ingredient_label?
    expr:ltr_shorthand eol {
      const labelledExpr = label !== null ? { ...expr, label } : expr;
      return {
        kind: 'stmt',
        offset: heading !== null ? heading[0].offset
              : label !== null ? label.offset
              : expr.offset,
        expr: labelledExpr,
        outputs: heading,
        named: heading !== null,
      };
    }

// `:=` — a sub-recipe heading. One or more comma-separated output names.
sub_recipe_heading
  = outputs:output_list hsp? ":=" hsp? { return outputs; }

// `=` — an ingredient label. A single name bound to the statement's node.
ingredient_label
  = name:output hsp? "=" hsp? { return name; }

output_list
  = first:output rest:(hsp? "," hsp? o:output { return o; })* {
      return [first, ...rest];
    }

output
  = string

expr
  = step
  / reference
  / "(" sp? inner:ltr_shorthand sp? ")" { return inner; }

ltr_shorthand
  = first:expr steps:(hsp? "," hsp? a:action { return a; })* {
      let acc = first;
      for (const step of steps) {
        acc = { kind: 'step', offset: step.offset, name: step, inputs: [acc] };
      }
      return acc;
    }

step
  = name:action hsp? "(" sp?
      first:expr
      rest:(sp? "," sp? e:expr { return e; })*
      (sp? ",")?
    sp? ")" {
      return { kind: 'step', offset: name.offset, name, inputs: [first, ...rest] };
    }

action
  = string

reference
  = amt:((proportion / implicit_quantity) hsp?)? name:ingredient {
      const amount = amt !== null ? amt[0] : null;
      return {
        kind: 'reference',
        offset: amount !== null ? amount.offset : name.offset,
        name,
        amount,
      };
    }

ingredient
  = string

implicit_quantity
  = num:number
    unitPart:(usp:hsp? u:known_unit prep:(psp:hsp p:preposition { return psp + p; })? {
        return { usp, unit: u, prep };
    })? {
      let unit = null;
      let valueUnitSpacing = '';
      let preposition = '';
      if (unitPart !== null) {
        unit = unitPart.unit;
        if (unitPart.usp !== null) { valueUnitSpacing = unitPart.usp; }
        if (unitPart.prep !== null) { preposition = unitPart.prep; }
      }
      return {
        kind: 'quantity',
        offset: num.offset,
        value: num.value,
        unit,
        valueUnitSpacing,
        preposition,
      };
    }

/*
 * Only the remainder form ("use the rest"). Grid 2's numeric proportions
 * (percentage / multiplier / fractional value) are dropped: the published Grid 2
 * recipe corpus never uses them, and real recipes only ever say "use the rest".
 */
proportion
  = wording:remainder prep:(psp:hsp p:preposition { return psp + p; })? {
      return {
        kind: 'remainder',
        offset: location().start.offset,
        wording,
        preposition: prep !== null ? prep : '',
      };
    }

remainder
  = $(( [rR][eE][mM][aA][iI][nN][iI][nN][gG]
      / [rR][eE][mM][aA][iI][nN][dD][eE][rR]
      / [rR][eE][sS][tT]
      / [lL][eE][fF][tT] [ \t]* [oO][vV][eE][rR]
      ) ![A-Za-z0-9])

preposition
  = $([oO][fF] ([ \t]+ [tT][hH][eE])? ![A-Za-z0-9])

known_unit
  = u:$(@KNOWN_UNITS@) ![A-Za-z0-9] {
      return { kind: 'string', offset: location().start.offset, substrings: [{ kind: 'substring', offset: location().start.offset, string: u }] };
    }

string
  = first:(naked_string / s_quoted_string / d_quoted_string / bracketed_string)
    rest:(sp:(s:hsp { return { offset: location().start.offset, string: s }; })? more:string { return { sp, more }; })? {
      const substrings = [...first];
      if (rest !== null) {
        if (rest.sp !== null) {
          substrings.push({ kind: 'substring', offset: rest.sp.offset, string: rest.sp.string });
        }
        substrings.push(...rest.more.substrings);
      }
      return { kind: 'string', offset: substrings[0].offset, substrings };
    }

/*
 * Canonical grammar.peg writes this as `x (y* z)?` so an interior space may be
 * part of a naked string. In Peggy that structure yields per-character results;
 * a single `$([class]+)` captures the whole run and is the idiomatic equivalent.
 * Interior spaces are handled at `string`, which joins runs with their `hsp`.
 */
naked_string
  = s:$([^"',:=/(){} \t\r\n]+) {
      return [{ kind: 'substring', offset: location().start.offset, string: s }];
    }

/*
 * Quoted strings are a literal-name escape hatch: the content is not parsed for
 * quantity/units. The body is captured raw via $() — escapes are NOT resolved
 * (a backslash stays a backslash). Bad input just breaks the recipe. The quotes
 * are matched outside the $() so they are stripped from the stored substring.
 */
d_quoted_string
  = '"' s:$(("\\" . / [^"\r\n])*) '"' {
      return [{ kind: 'substring', offset: location().start.offset, string: s }];
    }

s_quoted_string
  = "'" s:$(("\\" . / [^'\r\n])*) "'" {
      return [{ kind: 'substring', offset: location().start.offset, string: s }];
    }

/*
 * A brace-wrapped scale-aware string, e.g. "{1 handful}". The braces mark
 * embedded numbers as scalable interpolated values; the surrounding text is
 * literal. The braces are stripped. Peggy's repetition yields a flat array
 * mixing number nodes with per-character literals, so adjacent character runs
 * are coalesced back into a single substring here (raw-string discipline —
 * never store per-char). Grid 2's ScaledValueExpression; the grammar only marks
 * what is scalable, the runtime does the scaling.
 */
bracketed_string
  = "{" parts:(interpolated_number / esc:("\\" c:. { return c; }) / c:[^0-9{}\r\n] { return c; })* "}" {
      const out = [];
      let run = null;
      for (const part of parts) {
        if (typeof part === 'string') {
          if (run === null) { run = { kind: 'substring', offset: null, string: '' }; }
          run.string += part;
        } else {
          if (run !== null) { out.push(run); run = null; }
          out.push(part);
        }
      }
      if (run !== null) { out.push(run); }
      return out;
    }

interpolated_number
  = n:number {
      return { kind: 'interpolatedValue', offset: n.offset, number: n.value };
    }

number
  = fraction
  / decimal

fraction
  = intPart:($([0-9]+) hsp)? numer:$([0-9]+) hsp? "/" hsp? denom:$([0-9]+) {
      const whole = intPart !== null ? parseInt(intPart[0], 10) : 0;
      const f = new Fraction(whole).add(new Fraction(parseInt(numer, 10), parseInt(denom, 10)));
      const value = { numerator: Number(f.s * f.n), denominator: Number(f.d) };
      return { offset: location().start.offset, value };
    }

decimal
  = n:$([0-9]+ ("." [0-9]*)?) {
      const value = n.includes('.') ? parseFloat(n) : parseInt(n, 10);
      return { offset: location().start.offset, value };
    }

sp
  = $([ \t\n\r\f\v]+)

hsp
  = $([ \t]+)

eol
  = $([ \t]* [\r\n] [ \t\n\r\f\v]*)
  / $([ \t]*) eof

eof
  = !.
