# TurboWarp Runtime Expression

Turn [Temporary Variables](https://extensions.turbowarp.org/) into safe Boolean conditions, then broadcast only when a condition changes between `false` and `true`.

**Full user guide:** [English](https://kubohiroya.github.io/turbowarp-runtime-expression/) · [日本語](https://kubohiroya.github.io/turbowarp-runtime-expression/ja/)

## What it does

Runtime Expression adds two ways to use runtime state in a TurboWarp project:

- **Check the current state:** the `condition` reporter evaluates an expression and returns `true` or `false`.
- **React to a state change:** a conditional broadcast watcher sends one message when a condition becomes true and another when it becomes false.

```text
Temporary Variables  →  restricted expression parser  →  current result
                                                        false ⇄ true
                                                           │
                                                           └─ broadcast only on a transition
```

The expression language looks like a small part of JavaScript, but it cannot run functions, assignments, or arbitrary property access. The implementation does not use `eval` or `new Function`.

## Before you start

You need:

1. TurboWarp Desktop or another environment that can load an unsandboxed custom extension.
2. TurboWarp's **Temporary Variables** extension, loaded before Runtime Expression.
3. Permission to select **Run extension without sandbox** when loading Runtime Expression.

> [!CAUTION]
> Unsandboxed extensions can access the TurboWarp VM directly. Load the extension only from a source you trust.

## Quick start

1. Add the **Temporary Variables** extension to your project.
2. Add the following URL as a custom extension:

   ```text
   https://cdn.jsdelivr.net/npm/@kubohiroya/turbowarp-runtime-expression@0.4.0/dist/runtime-expression.js
   ```

3. Enable **Run extension without sandbox** when TurboWarp asks.
4. Create a runtime variable named `state` with Temporary Variables and set it to `ready`.
5. Put this expression in the `condition` block:

   ```js
   state == "ready"
   ```

The block now reports `true`. If `state` is missing or contains another value, it reports `false`.

To install the reviewed build from npm instead:

```bash
npm install --save-exact @kubohiroya/turbowarp-runtime-expression@0.4.0
```

Then load `node_modules/@kubohiroya/turbowarp-runtime-expression/dist/runtime-expression.js`.

## Composition API

Applications that already own their runtime state can evaluate the same restricted
condition language without registering Scratch blocks or using Temporary Variables:

```ts
import {createRuntimeExpressionComposition} from
  '@kubohiroya/turbowarp-runtime-expression/composition';

const expressions = createRuntimeExpressionComposition();
const canContinue = expressions.evaluateCondition(
  'state === "ready" && score >= 10',
  {state: 'ready', score: 10}
);

expressions.releaseAll();
```

The variables argument must be a plain object whose own enumerable data properties
contain only strings, finite numbers, or booleans. Inherited and unknown variables
are not resolved. An unknown variable that is actually evaluated throws a
`RuntimeExpressionCompositionError`; normal logical short-circuiting still applies.
`releaseAll()` clears the bounded parsed-expression cache and the composition remains
reusable. Importing this entry point does not read `Scratch`, the DOM, network,
storage, or Temporary Variables.

## Check the current state

A bare name reads the runtime variable with the same name:

```js
state == "ready" && score >= 10
```

String values must be quoted. An unquoted word such as `ready` is treated as another variable name.

For a variable name containing spaces, Japanese, or other non-ASCII characters, use the exact `vars["name"]` form:

```js
vars["current state"] === "ready" && vars["得点"] >= 10
```

A missing runtime variable evaluates as `undefined`, so you can check for it explicitly:

```js
nextScene === undefined
```

## Broadcast when the result changes

Register a watcher with five values:

| Input | Purpose | Example |
|---|---|---|
| `ID` | Stable name used to replace or unregister this watcher | `level-ready` |
| `CONDITION` | Expression to monitor | `state == "ready"` |
| `MESSAGE_ON_TRUE` | Broadcast on `false → true` | `state ready` |
| `MESSAGE_ON_FALSE` | Broadcast on `true → false` | `state not ready` |
| `TIMEOUT` | Seconds before automatic removal; `0` means no timeout | `0` |

The watcher evaluates once when registered and remembers that initial result **without broadcasting**. After that:

| Result change | Behavior |
|---|---|
| `false → true` | Broadcasts `MESSAGE_ON_TRUE` |
| `true → false` | Broadcasts `MESSAGE_ON_FALSE` |
| `false → false` or `true → true` | Sends nothing |

Important lifecycle rules:

- Registering the same ID again replaces the previous watcher and its remembered state.
- A positive timeout removes the watcher silently; zero or less keeps it active.
- The unregister block removes the watcher with the matching ID. An unknown ID has no effect.
- Project start and stop clear all watchers, so register them again from your startup scripts.
- Multiple variable updates within one VM frame are combined; the watcher observes the final state on the next frame.

## Expression syntax

| Supported | Examples |
|---|---|
| Values | finite numbers, quoted strings, `true`, `false`, `null`, `undefined` |
| Unary operators | `!`, unary `+`, unary `-` |
| Arithmetic | `+`, `-`, `*`, `/`, `%` |
| Comparison | `==`, `!=`, `===`, `!==`, `<`, `<=`, `>`, `>=` |
| Logic | <code>&amp;&amp;</code>, <code>&#124;&#124;</code> with short-circuit evaluation |
| Grouping and lookup | parentheses, exact `vars["name"]` lookup |

Assignments, function calls, general property access, `new`, arrays, objects, optional chaining, and template strings are rejected. Expression length, token count, nesting depth, and the parsed-expression cache are bounded.

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

## Compatibility

The extension ID is `kubohiroyaruntimeexpression`. Projects that still store the old `twRuntimeExpression` opcodes need a schema-aware project migration; replacing only the JavaScript file will break those stored blocks.

The `runtimeExpression` and `conditionalBroadcast` compile-time feature flags live in `config/feature-flags.ts`. Both are enabled by default.

## Development

```bash
npm install
npm run check
```

The build produces `dist/runtime-expression.js`, `dist/composition.js`, and declarations in `dist/types/`. Commit the rebuilt files whenever source changes. The block reference above is generated from `src/block-definitions.json`; keep the marker comments intact.

### GitHub Pages

The workflow in `.github/workflows/pages.yml` publishes `docs/` after documentation changes reach `main`. The English guide is served at the site root and the Japanese guide at `/ja/`.

To roll back the guide, revert the documentation and workflow change. For an immediate withdrawal, disable the Pages workflow and GitHub Pages in the repository settings; this does not affect the extension runtime.

### Releases

The tag-triggered release workflow checks the immutable source, packs the npm
artifact, and attaches the standalone bundle, composition bundle, declarations,
and tarball to the matching GitHub Release. Follow [RELEASING.md](RELEASING.md)
for versioning, npm publication, verification, and rollback.

## License

MPL-2.0
