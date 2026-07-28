# utils/ — pipeline probe scripts

Temporary not committed diagnostic scripts that dump each stage of the pipeline so you can **read the shape** and check it by eye. They are the oracle for DAG/structure work: probe the pipeline, don't reason about (or count) output. Not shipped, not tested - throwaway harnesses kept around in case a session digs into internals.

Run any of them with node from anywhere; paths resolve relative to the package
(`const PKG = new URL('..', import.meta.url).pathname`). Most target the
turkish-pizza recipe in `apps/site`.

```
node utils/probe-compile.mjs
```

## What each dumps
- `probe-ast.mjs` - the raw AST for turkish-pizza (grammar output).
- `probe-ast-stmts.mjs` - one line per top-level AST stmt (expr kind / outputs / named).
- `probe-compile.mjs` - the full compiled DAG (cycle-safe JSON; `<<circular>>` at back-pointers).
- `probe-resolve.mjs` - traces every `reference` to the node it resolves to.
- `probe-walk.mjs` - runs `walkRecipe`, prints grid extent + part census.
- `probe-build.mjs` - runs `build()`, prints the element-tree tag census.
- `probe-render.mjs` - full pipeline -> an HTML file with the headless CSS inlined (the render-inspect).
- `probe-dump-dom.mjs` - serializes the walked StructureNode to exact markup (the DOM-shape reference for comparison; adaptable to a fixture).
- `probe-stress.mjs` - edge-case recipes (remainder, forward-ref, `,action`, duplicate `:=` names).
- `probe-transclude.mjs` - prints the Topping subtree to check references transclude full bodies.
- `probe-step-shape.mjs` - the emitted element shape of a single step (inputs-wrapper check).
- `probe-multi-output.mjs` - AST + DAG for a multi-output `foo, bar, baz :=` heading.
- `probe-remainder.mjs` - where the "remaining X" wording lands (AST vs compiled).
- `probe-walk-vs-dag.mjs` - early walk/DAG comparison scratch.
- `probe-extract-shape.mjs` - the `CardShape` from `extract-shape.ts`'s first pass: regions, cells in row/column order with their spans and neighbours, and an occupancy map. Takes an optional path argument (defaults to turkish-pizza);
  `tests/fixtures/hot-hamburger.md`, so its geometry can be read against a known-correct one. Read the occupancy map as a grid — holes and overlaps show there, not in the numbers.
