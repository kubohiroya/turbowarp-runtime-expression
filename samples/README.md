# Runtime Expressionの最小デモ

- 配布: [`condition-score-gate.sb3`](https://kubohiroya.github.io/turbowarp-runtime-expression/samples/condition-score-gate.sb3)
- 起動: [TurboWarp Editor](https://turbowarp.org/editor?project_url=https%3A%2F%2Fkubohiroya.github.io%2Fturbowarp-runtime-expression%2Fsamples%2Fcondition-score-gate.sb3)
- 操作: **Run without sandbox**を選んで**Allow**し、緑の旗を押します。
- 内容: 点数を変え、`validateConditionSyntax`と`runtimeCondition`による合格判定を表示
- 期待結果: The score condition is false at 9 and true at 10.

実行時変数の評価に必要な公式**Temporary Variables**拡張もプロジェクトから読み込みます。インターネット接続が必要です。

`manifest.json`に拡張ID・JSパス・sandbox条件・期待結果を記録しています。
`condition-score-gate/project.json`と自作SVGを編集し、次のコマンドで再生成します。

```bash
pnpm run samples:build
pnpm run samples:check
pnpm run pages:build
```

Node.jsは`.nvmrc`指定版を使います。サンプル生成に追加依存はありません。
生成したSB3もコミットし、`_site/`のdocs・dist・SB3をPagesへ公開します。
unsandboxed拡張は検証対象JSをSB3へ同梱し、利用者が通常の同意画面で許可します。
sandbox互換の拡張はPages上のJSを参照します。

緑の旗で毎回入力から結果を生成します。停止してから再実行できます。

切戻しはサンプル・READMEリンク・Pages配信設定の追加をrevertします。
