# TurboWarp Runtime Expression

A safe JavaScript-like condition evaluator and conditional broadcast monitor for TurboWarp Temporary Variables runtime variables.

## Installation

Build or download `dist/runtime-expression.js`, then load it as a local custom extension in TurboWarp Desktop with **Run extension without sandbox** enabled. Load TurboWarp's **Temporary Variables** extension before using the condition or conditional broadcast blocks.

The condition reporter and conditional broadcasts are guarded by the compile-time `runtimeExpression` and `conditionalBroadcast` feature flags in `config/feature-flags.ts`. Both flags are ON by default.

## Extension ID compatibility

This migration release uses the standards-compliant ID `kubohiroyaruntimeexpression`. Existing
projects that store `twRuntimeExpression` opcodes must apply a schema-aware project migration at
the same time; replacing the JavaScript artifact alone would break their existing blocks.

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

## Conditional broadcasts

A conditional broadcast registration has a unique ID, a condition, messages for true and false transitions, and an optional timeout in seconds. Registration evaluates the condition once without broadcasting. Each VM frame then compares only the runtime variables referenced by the condition and re-evaluates the condition when one of those values or its existence changes.

A false-to-true result broadcasts the true message, and a true-to-false result broadcasts the false message. Runtime variable changes that leave the boolean result unchanged do not broadcast. Re-registering an ID replaces it atomically, while unregistering an unknown ID has no effect.

Positive timeouts remove registrations silently. A timeout of zero or less keeps the registration until it is unregistered or the project starts or stops. Multiple variable updates in one frame are coalesced into the final state observed on the next frame.

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

### `register [ID] conditional broadcast [CONDITION] [MESSAGE_ON_TRUE] / [MESSAGE_ON_FALSE] with [TIMEOUT] seconds timeout`

Registers broadcasts for false-to-true and true-to-false runtime condition changes.

| Property | Value |
|---|---|
| Type | Command |
| Opcode | `registerConditionalBroadcast` |
| Feature flag | `conditionalBroadcast` |
| `ID` | String, default: `watcher` |
| `CONDITION` | String, default: `state == "ready"` |
| `MESSAGE_ON_TRUE` | String, default: `state ready` |
| `MESSAGE_ON_FALSE` | String, default: `state not ready` |
| `TIMEOUT` | Number, default: `0` |

### `unregister [ID] conditional broadcast`

Unregisters the conditional broadcast with the matching ID.

| Property | Value |
|---|---|
| Type | Command |
| Opcode | `unregisterConditionalBroadcast` |
| Feature flag | `conditionalBroadcast` |
| `ID` | String, default: `watcher` |

<!-- END GENERATED BLOCKS -->

## Development

```bash
npm install
npm run check
```

The build produces `dist/runtime-expression.js`. Commit the rebuilt file whenever extension source changes.

## License

MPL-2.0
