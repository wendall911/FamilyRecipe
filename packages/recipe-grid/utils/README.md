# utils/ — pipeline probe scripts

Diagnostic scripts that dump each stage of the pipeline so the shape can be read
and checked. They are the oracle for DAG/structure work: probe the pipeline,
don't reason about (or count) output. Not shipped, not tested — modifiable
harnesses kept for when internals are a target of the work.

Read the script before running it. These entries say which stage a script points
at; the script is the description of what it prints.

Run any of them with node from anywhere; paths resolve relative to the package
(`const PKG = new URL('..', import.meta.url).pathname`). They take an optional
path argument and default to the turkish-pizza recipe in `apps/site`.

```
node utils/probe-compile.mjs
```

## In use
- `probe-ast.mjs` — the grammar's AST.
- `probe-compile.mjs` — the compiled DAG, as cycle-safe JSON (`<<circular>>` where a shared node is reached again).
- `probe-extract-shape.mjs` — the `CardShape` from `extract-shape.ts`.
- `probe-extract-structure.mjs` — the `StructureNode` tree from `extract-structure.ts`.
- `probe-build.mjs` — `build()`.

## Older — answered a question during development; read before trusting
- `probe-ast-stmts.mjs` — the AST's top-level statements.
- `probe-resolve.mjs` — each `reference` and the node it resolves to.
- `probe-stress.mjs` — edge-case recipes (remainder, forward-ref, `,action`, duplicate `:=` names).
- `probe-multi-output.mjs` — AST + DAG for a multi-output `foo, bar, baz :=` heading.
- `probe-remainder.mjs` — where "remaining X" wording lands, AST vs compiled.
