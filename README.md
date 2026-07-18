# TurboWarp Runtime Expression

A safe JavaScript-like condition evaluator for TurboWarp Temporary Variables runtime variables.

## Installation

Build or download `dist/runtime-expression.js`, then load it as a local custom extension in TurboWarp Desktop with **Run extension without sandbox** enabled. Load TurboWarp's **Temporary Variables** extension before using the condition block.

The initial implementation is guarded by the compile-time `runtimeExpression` feature flag in `config/feature-flags.ts`, which is OFF by default.

## Expression syntax

A bare identifier reads the runtime variable with the same name:

```js
!(state == "paused" && scene == "intro") || score > 10
```

String literals must be quoted. Runtime variable names that are not ASCII JavaScript identifiers use the restricted `vars["name"]` form:

```js
vars["current state"] === "ready" && vars["得点"] >= 10
```

Missing variables evaluate as `undefined`. Supported syntax:

- finite numbers, quoted strings, `true`, `false`, `null`, and `undefined`;
- unary `!`, `+`, and `-`;
- arithmetic `+`, `-`, `*`, `/`, and `%`;
- comparison `==`, `!=`, `===`, `!==`, `<`, `<=`, `>`, and `>=`;
- logical `&&` and `||` with short-circuit evaluation;
- parentheses and exact `vars["name"]` lookup.

Assignments, function calls, general property access, `new`, arrays, objects, optional chaining, and template strings are rejected. The implementation does not use `eval` or `new Function`. Expression length, token count, nesting depth, and the parsed-expression cache are bounded.

## Blocks

<!-- BEGIN GENERATED BLOCKS -->

### `condition [EXPRESSION]`

Safely evaluates a JavaScript-like condition using Temporary Variables runtime variables.

| Property | Value |
|---|---|
| Type | Boolean |
| Opcode | `runtimeCondition` |
| Feature flag | `runtimeExpression` |
| `EXPRESSION` | String, default: `state == "ready"` |

<!-- END GENERATED BLOCKS -->

## Development

```bash
npm install
npm run check
```

The build produces `dist/runtime-expression.js`. Commit the rebuilt file whenever extension source changes.

## License

MPL-2.0
