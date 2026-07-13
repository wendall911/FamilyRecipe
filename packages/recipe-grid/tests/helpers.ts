/** Recursively collect every node (object) matching `pred`, in tree order. */
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
