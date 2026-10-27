# Changelog

## 0.8.1 - 2026-10-28

- Pagesで動作するsamplesデモを追加しました。npm公開物のAPI・拡張ID・既定値は変わりません。

## 0.8.0 - 2026-10-27

- ビルド依存をplugin 0.9.0 / data-editor 0.4.0へ更新。
- ロールバック: @kubohiroya/turbowarp-runtime-expression@0.7.0 を固定して利用する。

## 0.7.0 - 2026-10-26

- ビルド依存をplugin 0.8.0 / data-editor 0.3.4へ更新。
- 既存の式構文・公開API・フラグの既定値を維持。切り戻しは `@kubohiroya/turbowarp-runtime-expression@0.6.1` へ固定（前minor系列: `@kubohiroya/turbowarp-runtime-expression@0.6.0`）。

## 0.6.1 - 2026-10-19

- Publish the selected Git source with explicit base revision metadata and exact latest internal npm dependencies.
- Preserve public APIs and block data contracts; prior release history is retained below.


## 0.6.0 — 2026-09-10

- Migrate the repository scripts from `.mjs` to TypeScript and run them with Node's native type stripping.
- Raise `engines.node` to `>=22.18.0`, the first release that runs TypeScript sources without a flag.
- Move the build to Vite 8 and `vite-plugin-turbowarp-extension` 0.3.0; the tracked extension bundle is regenerated.
- Keep expression syntax, watcher lifecycle, extension ID, opcodes, and public Composition API unchanged.
- Roll back by pinning `@kubohiroya/turbowarp-runtime-expression@0.5.0`.

## 0.5.0 — 2026-08-25

- Standardize package metadata, Pages homepage, Node 22, and pnpm maintainer commands.
- Add repository policy checks for versioned README/CDN/release-note consistency and package archive contents.
- Keep expression syntax, watcher lifecycle, extension ID, opcodes, and public Composition API unchanged.
- Roll back by pinning `@kubohiroya/turbowarp-runtime-expression@0.4.0`.

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
