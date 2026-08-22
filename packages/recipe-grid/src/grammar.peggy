/*
 * Recipe Grid grammar a partial Peggy port of recipe_grid's parser/grammar.peg.
 * With multiple divergences to support recipe-grid.
 *
 * Structure and rule set mostly follow the canonical grammar.peg (mossblaser's
 * recipe_grid, consumed there by the `peggie` PEG engine). Peggy notation
 * differs from peggie: `=` instead of `<-`, character classes / regex literals
 * instead of peggie's `r"..."` regex terminals. The rule actions build the AST
 * directly; `compiler.ts` compiles that AST to the DAG model.
 *
 * @KNOWN_UNITS@ is substituted at generate time with an ordered choice of every
 * known unit name, built by `units.ts` from parse-ingredient's vocabulary,
 * longest-first so a name matches maximally.
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
 *   `:=`  sub_recipe_heading - names a sub-recipe (one or more outputs).
 *   `=`   ingredient_label   - a single label on the statement's node.
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

// `:=` - a sub-recipe heading. One or more comma-separated output names.
sub_recipe_heading
  = outputs:output_list hsp? ":=" hsp? { return outputs; }

// `=` - an ingredient label. A single name bound to the statement's node.
ingredient_label
  = name:output hsp? "=" hsp? { return name; }

output_list
  = first:output rest:(hsp? "," hsp? o:output { return o; })* {
      return [first, ...rest];
    }

output
  = string

expr
  = external_reference
  / step
  / reference
  / "(" sp? inner:ltr_shorthand sp? ")" { return inner; }

/*
 * A bare markdown link, e.g. "[Dough](pizza-dough)" - a cross-file reference to
 * another recipe by identity. Tried before `step`/`reference` so a link is not
 * globbed as literal ingredient text. Self-naming: the link text is the local
 * name later lines resolve to; the href is the target recipe id. Both bodies
 * are captured raw - validation (is the slug real, does the target exist) is a
 * separate concern against the full AST, not the parser's: garbage in, garbage
 * out. The sibling/alternative to `label`; like `label`, it may sit on an
 * ingredient or a step.
 */
 external_reference
  = amt:(a:(proportion / implicit_quantity) hsp { return a; })?
    "[" name:$([^\]\r\n]+) "]" hsp?
    "(" target:$([^)"'\r\n \t]+) titlePart:(hsp? t:link_title { return t; })? ")" {
      return {
        kind: 'externalReference',
        offset: location().start.offset,
        name,
        targetSlug: target,
        ...(titlePart !== null ? { title: titlePart } : {}),
        amount: amt,
      };
    }

/*
 * The optional markdown link title - the quoted third token in
 * "[text](slug \"title\")". Quotes matched outside $() so they are stripped;
 * the raw inner text is returned (a plain string, matching name/targetSlug,
 * not a String node). CommonMark also permits a (…)-wrapped title; that form
 * is intentionally not supported here.
 */
link_title
  = '"' t:$([^"\r\n]*) '"' { return t; }
  / "'" t:$([^'\r\n]*) "'" { return t; }

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

/*
 * The gap between an amount and the name it measures is content, not a
 * separator: it is what preceded the name. It rides the reference, because the
 * name is the reference's own and lives in one place.
 */
reference
  = amt:(a:(proportion / implicit_quantity) gap:hsp? {
        return { amount: a, gap: gap !== null ? gap : '' };
    })? name:ingredient {
      const amount = amt !== null ? amt.amount : null;

      return {
        kind: 'reference',
        offset: amount !== null ? amount.offset : name.offset,
        leading: amt !== null ? amt.gap : '',
        name,
        amount,
      };
    }

ingredient
  = string

implicit_quantity
  = num:number
    unitPart:(usp:hsp? u:known_unit prep:(psp:hsp p:preposition_string {
        return {
          kind: 'quantityPart',
          offset: location().start.offset,
          leading: psp,
          text: p,
        };
    })? {
        const unit = {
          kind: 'quantityPart',
          offset: location().start.offset,
          leading: usp !== null ? usp : '',
          text: u,
        };
        return { unit, prep };
    })? {
      const parts = [];
      if (unitPart !== null) {
        parts.push(unitPart.unit);
        if (unitPart.prep !== null) { parts.push(unitPart.prep); }
      }
      return {
        kind: 'quantity',
        offset: num.offset,
        value: num.value,
        parts,
      };
    }

/*
 * Only the remainder form ("use the rest"). Grid 2's numeric proportions
 * (percentage / multiplier / fractional value) are dropped: the published Grid 2
 * recipe corpus only uses them for validation, and real recipes only ever say
 * "use the rest".
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

preposition_string
  = p:preposition {
      return {
        kind: 'string',
        offset: location().start.offset,
        substrings: [{
          kind: 'substring',
          offset: location().start.offset,
          string: p,
        }],
      };
    }

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
 * quantity/units. The body is captured raw via $() - escapes are NOT resolved
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
 * are coalesced back into a single substring here (raw-string discipline and
 * never store per-char). Grid 2's ScaledValueExpression; the grammar only marks
 * what is scalable, the runtime does the scaling.
 *
 * The gap after an interpolated number is a separator, not content: the braces
 * are how an author declares a unit the vocabulary has no name for, and the
 * space between the value and that name is the same separator
 * `implicit_quantity` drops from "4 cloves". It is matched and discarded, so
 * the name is stored as itself.
 */
bracketed_string
  = "{" parts:(n:interpolated_number hsp? { return n; } / esc:("\\" c:. { return c; }) / c:[^0-9{}\r\n] { return c; })* "}" {
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
