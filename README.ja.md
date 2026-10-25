# TurboWarp-Runtime-Expression

<img src="assets/block-icon.svg" alt="" width="48" height="48">

[English](README.md) | 日本語

[Temporary Variables](https://extensions.turbowarp.org/)を安全なBoolean条件に変え、条件が`false`と
`true`の間で変化したときだけブロードキャストします。

**詳しいユーザーガイド:** [English](https://kubohiroya.github.io/turbowarp-runtime-expression/) · [日本語](https://kubohiroya.github.io/turbowarp-runtime-expression/ja/)

## できること

Runtime Expressionは、TurboWarpのプロジェクトで実行時の状態を使う方法を2つ追加します。

- **今の状態を調べる:** `condition` reporterが式を評価し、`true`または`false`を返します。
- **状態の変化に反応する:** 条件付きブロードキャストのwatcherが、条件がtrueになったときと
  falseになったときに、それぞれ別のメッセージを送ります。

```text
Temporary Variables  →  restricted expression parser  →  current result
                                                        false ⇄ true
                                                           │
                                                           └─ broadcast only on a transition
```

式の言語はJavaScriptの一部に似ていますが、関数の実行、代入、任意のプロパティアクセスはできません。
実装は`eval`も`new Function`も使いません。

## 始める前に

必要なものです。

1. TurboWarp Desktop、またはunsandboxedなカスタム拡張機能を読み込める他の環境。
2. TurboWarpの**Temporary Variables**拡張機能。Runtime Expressionより先に読み込みます。
3. Runtime Expressionの読み込み時に**サンドボックス化せずに実行**を選べる権限。

> [!CAUTION]
> unsandboxedな拡張機能はTurboWarpのVMへ直接アクセスできます。信頼できる配布元からのみ読み込んでください。

## クイックスタート

1. プロジェクトに**Temporary Variables**拡張機能を追加します。
2. 次のURLをカスタム拡張機能として追加します。

   ```text
   https://cdn.jsdelivr.net/npm/@kubohiroya/turbowarp-runtime-expression@0.7.0/dist/runtime-expression.js
   ```

3. TurboWarpが確認したら**サンドボックス化せずに実行**を有効にします。
4. Temporary Variablesで`state`という実行時変数を作り、`ready`を設定します。
5. `condition` blockに次の式を入れます。

   ```js
   state == "ready"
   ```

これでblockは`true`を返します。`state`が存在しない場合や別の値の場合は`false`を返します。

レビュー済みのビルドをnpmから導入する場合は次を使います。

```bash
pnpm add --save-exact @kubohiroya/turbowarp-runtime-expression@0.7.0
```

その後`node_modules/@kubohiroya/turbowarp-runtime-expression/dist/runtime-expression.js`を読み込みます。

## Composition API

実行時の状態を自前で持っているアプリケーションは、Scratchのblockを登録せず、Temporary Variablesも
使わずに、同じ制限付き条件言語を評価できます。

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

変数の引数は、自身のenumerableなdata propertyが文字列・有限の数値・真偽値だけからなるplain objectで
なければなりません。継承されたプロパティや未知の変数は解決しません。実際に評価された未知の変数は
`RuntimeExpressionCompositionError`を投げます。論理演算の短絡評価は通常どおり働きます。
`releaseAll()`は上限付きのパース済み式cacheを消去し、compositionはそのまま再利用できます。この
entry pointをimportしても、`Scratch`、DOM、ネットワーク、ストレージ、Temporary Variablesを読みません。

## 今の状態を調べる

裸の名前は、同じ名前の実行時変数を読みます。

```js
state == "ready" && score >= 10
```

文字列の値は引用符で囲む必要があります。`ready`のように引用符のない語は、別の変数名として扱われます。

空白、日本語、その他の非ASCII文字を含む変数名には、`vars["name"]`の形を使います。

```js
vars["current state"] === "ready" && vars["得点"] >= 10
```

存在しない実行時変数は`undefined`として評価されるため、明示的に確認できます。

```js
nextScene === undefined
```

## 結果が変わったときにブロードキャストする

watcherは5つの値で登録します。

| 入力 | 用途 | 例 |
|---|---|---|
| `ID` | このwatcherを置き換え・登録解除するための安定した名前 | `level-ready` |
| `CONDITION` | 監視する式 | `state == "ready"` |
| `MESSAGE_ON_TRUE` | `false → true`で送るブロードキャスト | `state ready` |
| `MESSAGE_ON_FALSE` | `true → false`で送るブロードキャスト | `state not ready` |
| `TIMEOUT` | 自動削除までの秒数。`0`はタイムアウトなし | `0` |

watcherは登録時に1回評価し、その初期結果を**ブロードキャストせずに**記憶します。その後の挙動です。

| 結果の変化 | 動作 |
|---|---|
| `false → true` | `MESSAGE_ON_TRUE`をブロードキャストします |
| `true → false` | `MESSAGE_ON_FALSE`をブロードキャストします |
| `false → false`または`true → true` | 何も送りません |

lifecycleの重要な規則です。

- 同じIDで再登録すると、前のwatcherと記憶していた状態を置き換えます。
- 正のタイムアウトはwatcherを無言で削除します。0以下なら有効なままです。
- 登録解除のblockは、IDが一致するwatcherを削除します。未知のIDは何もしません。
- プロジェクトの開始と停止はすべてのwatcherを消すため、起動時のscriptから登録し直してください。
- 1つのVM frame内の複数回の変数更新はまとめられ、watcherは次のframeで最終状態を観測します。

## 式の文法

| 使えるもの | 例 |
|---|---|
| 値 | 有限の数値、引用符付き文字列、`true`、`false`、`null`、`undefined` |
| 単項演算子 | `!`、単項`+`、単項`-` |
| 算術 | `+`、`-`、`*`、`/`、`%` |
| 比較 | `==`、`!=`、`===`、`!==`、`<`、`<=`、`>`、`>=` |
| 論理 | <code>&amp;&amp;</code>、<code>&#124;&#124;</code>（短絡評価あり） |
| グループ化と参照 | 丸括弧、`vars["name"]`の厳密な参照 |

代入、関数呼び出し、一般のプロパティアクセス、`new`、配列、オブジェクト、optional chaining、
テンプレート文字列は拒否します。式の長さ、token数、ネストの深さ、パース済み式cacheには上限があります。

## ブロック

| block | 種別 | opcode | feature flag | 動作 |
|---|---|---|---|---|
| `condition [EXPRESSION]` | Boolean | `runtimeCondition` | `runtimeExpression` | Temporary Variablesの実行時変数を使い、JavaScript風の条件を安全に評価します。 |
| `register [ID] conditional broadcast [CONDITION] [MESSAGE_ON_TRUE] / [MESSAGE_ON_FALSE] with [TIMEOUT] seconds timeout` | Command | `registerConditionalBroadcast` | `conditionalBroadcast` | 実行時条件のfalse→trueおよびtrue→falseの変化に対するブロードキャストを登録します。 |
| `unregister [ID] conditional broadcast` | Command | `unregisterConditionalBroadcast` | `conditionalBroadcast` | IDが一致する条件付きブロードキャストを登録解除します。 |

既定値は`EXPRESSION`と`CONDITION`が`state == "ready"`、`ID`が`watcher`、`MESSAGE_ON_TRUE`が
`state ready`、`MESSAGE_ON_FALSE`が`state not ready`、`TIMEOUT`が`0`です。

## 互換性

拡張機能IDは`kubohiroyaruntimeexpression`です。旧`twRuntimeExpression`のopcodeを保存したままの
プロジェクトには、schemaを理解した移行処理が必要です。JavaScriptファイルだけを置き換えると、保存済みの
blockが壊れます。

`runtimeExpression`と`conditionalBroadcast`のコンパイル時feature flagは`config/feature-flags.ts`に
あります。どちらも既定で有効です。

## 開発

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm run check
```

ビルドは`dist/runtime-expression.js`、`dist/composition.js`、`dist/types/`の型宣言を生成します。
sourceを変更したら再ビルドしたファイルをcommitしてください。blockの一覧は
`src/block-definitions.json`から生成します。生成用のマーカーコメントは`README.md`側にあるので、
そちらを壊さないでください。

### GitHub Pages

ドキュメントの変更が`main`へ入ると、`.github/workflows/pages.yml`のworkflowが`docs/`を公開します。
英語ガイドはサイトのrootに、日本語ガイドは`/ja/`に配信されます。

ガイドを切り戻すには、ドキュメントとworkflowの変更をrevertします。即時に取り下げる場合は、リポジトリの
設定でPagesのworkflowとGitHub Pagesを無効にします。これは拡張機能の実行には影響しません。

### リリース

タグで起動するreleaseのworkflowは、変更されていないsourceを検査し、npmの成果物をpackし、standalone
bundle、composition bundle、型宣言、tarballを対応するGitHub Releaseへ添付します。versioning、npmへの
公開、検証、切り戻しは[RELEASING.md](RELEASING.md)に従ってください。

## ライセンス

SPDX-License-Identifier: MPL-2.0

## 固定入力の編集

対応するTurboWarp GUIでは、固定入力フォームを有効にすると標準のリテラル欄だけを編集できます。数値は
完全な有限のJSON number token、menu欄は既存の選択肢を使います。reporterが接続された欄と利用できない欄は
読み取り専用のままで、評価されることはありません。変更せずに保存した場合、旧来の表記や未知の選択肢を含め、
既存の生の値がそのまま保持されます。不正な下書きは同じ編集セッション内に留まり、cancel、プロジェクトや
targetの差し替え、blockの削除で破棄されます。GUIのfeature flagを無効にすると、元の欄の編集に戻ります。
このフォームはblockを実行せず、ネットワーク・音声・キー入力・QRのセッションを開かず、名前の解決もSchema
引数の編集も行いません。0以下のタイムアウト値は、期限なしを表すsentinelのまま保持します。

正式な契約は`schemas/block-editor-fixed-inputs.schema.json`、codecと任意の登録処理は
`src/fixed-input-editors.ts`にあります。これらの契約は新しい固定欄の候補を記述するもので、実行時データ全体を
再定義するものではありません。GUI統合は任意で、既存のstandalone/composition APIはそのまま使えます。

- `registerConditionalBroadcast`: TIMEOUT — [blockのドキュメント](https://kubohiroya.github.io/turbowarp-runtime-expression/#block-registerConditionalBroadcast)
