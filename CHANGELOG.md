# Changelog

## 0.4.0 — 2026-08-14

- Add a self-contained SVG block icon for identifying Runtime Expression blocks in TurboWarp.
- Keep block opcodes, feature flags, expression semantics, and runtime behavior unchanged.
- Roll back by pinning `@kubohiroya/turbowarp-runtime-expression@0.3.0`.

## 0.3.0 — 2026-08-06

- Add the `@kubohiroya/turbowarp-runtime-expression/composition` ESM entry point.
- Expose typed syntax validation, condition evaluation, and cache release without
  Scratch, DOM, network, storage, or Temporary Variables dependencies.
- Accept only own enumerable strings, finite numbers, and booleans as variables;
  reject inherited, unknown, or invalid evaluated inputs with stable diagnostics.
- Publish standalone and composition bundles plus TypeScript declarations together.

## 0.2.0 — 2026-08-03

- Add syntax-only condition validation.
- Publish the bilingual GitHub Pages guide and version-pinned installation URLs.

## 0.1.0 — 2026-07-29

- Publish the first npm package with the standards-compliant extension ID.
- Provide safe runtime-variable conditions and transition-triggered broadcasts.
