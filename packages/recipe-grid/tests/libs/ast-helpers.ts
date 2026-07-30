import assert from 'node:assert/strict';

import { parseFixture } from './ast-harness.ts';
import type {
    ExternalReference,
    InterpolatedValue,
    Reference,
    Stmt,
    Substring,
} from '../../src/ast.ts';

/**
 * The parts a `String`'s `substrings` holds.
 */
export type StringPart = Substring | InterpolatedValue;

/**
 * Recursively collect every node (object) matching `pred`, in tree order.
 */
export function findAll(
    node: unknown,
    pred: (o: Record<string, unknown>) => boolean,
): Record<string, unknown>[] {
    const out: Record<string, unknown>[] = [];
    const walk = (n: unknown): void => {
        if (Array.isArray(n)) {
            for (const c of n) walk(c);
        } else if (n !== null && typeof n === 'object') {
            const obj = n as Record<string, unknown>;
            if (pred(obj)) out.push(obj);
            for (const k of Object.keys(obj)) walk(obj[k]);
        }
    };

    walk(node);

    return out;
}

/**
 * Concatenate a `String`'s substrings, rendering interpolated values as text.
 */
export const substringsText = (parts: StringPart[]): string =>
    parts
        .map((p) => (p.kind === 'interpolatedValue' ? String(p.number) : (p.string ?? '')))
        .join('');

/**
 * Concatenate the substrings of a node's `name`.
 */
export const nameText = (n: { name: { substrings: StringPart[] } }): string =>
    substringsText(n.name.substrings);

/**
 * Collect every `reference` node in a fixture.
 */
export function referencesOf(name: string): Reference[] {
    return findAll(parseFixture(name), (o) => o.kind === 'reference') as unknown as Reference[];
}

/**
 * Fetch the reference in a fixture whose amount is a remainder. A remainder
 * only ever appears on a reference inside a step, at no fixed position.
 */
export function remainderRef(name: string, fixtureName: string): Reference {
    const found = findAll(
        parseFixture(fixtureName),
        (o) =>
            o.kind === 'reference' &&
            (o.amount as { kind?: string } | null)?.kind === 'remainder' &&
            substringsText((o.name as { substrings: StringPart[] }).substrings) === name,
    );

    assert.equal(found.length, 1, `expected one remainder reference named "${name}"`);

    return found[0] as unknown as Reference;
}

/**
 * Fetch the external reference in a fixture with the given link text.
 */
export function externalRef(name: string, fixtureName: string): ExternalReference {
    const found = findAll(
        parseFixture(fixtureName),
        (o) => o.kind === 'externalReference' && o.name === name,
    );

    assert.equal(found.length, 1, `expected one external reference named "${name}"`);

    return found[0] as unknown as ExternalReference;
}

/**
 * Fetch the statement in a fixture whose expression is a step with the given
 * name. For statements with no declared output, where `outputStmt` cannot
 * reach.
 */
export function stepStmt(name: string, fixtureName: string): Stmt {
    const stmt = parseFixture(fixtureName).stmts.find(
        (s) => s.expr.kind === 'step' && substringsText(s.expr.name.substrings) === name,
    );

    assert.ok(stmt, `expected a statement whose step is named "${name}"`);

    return stmt;
}

/**
 * Fetch the statement in a fixture whose declared output (`:=`) matches the
 * given text.
 */
export function outputStmt(name: string, fixtureName: string): Stmt {
    const stmt = parseFixture(fixtureName).stmts.find(
        (s) => s.outputs?.some((o) => substringsText(o.substrings) === name),
    );

    assert.ok(stmt, `expected a statement with output "${name}"`);

    return stmt;
}
