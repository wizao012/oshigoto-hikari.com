# おしごと光10G LP

法人・店舗向け「12ヶ月間 実質月額500円（税抜）」ワンコインキャンペーンの静的LPです。採用KVを主軸に、下段は説明・利用シーン・料金・品質・導入フローをコンテンツとして構成しています。キャンペーンの内訳と適用条件は、初期状態が閉じたアコーディオンに収録しています。

- リポジトリ: https://github.com/wizao012/oshigoto-hikari.com
- 配信ドメイン: https://oshigoto-hikari.com/
- GitHub Pages配信ファイルはリポジトリのルートに配置します。ビルドは不要です。
- `CNAME` は `oshigoto-hikari.com`、`.nojekyll` は静的ファイル配信用です。
- `index.html`、`styles.css`、`heritage.css`、`content.css`、`app.js` と、これらから参照する画像だけを同梱しています。
- 全18ファイルは同一階層です。画像は `media-*.png` / `media-*.webp` の名前で配信します。
- CSS・JavaScript参照にはキャッシュ更新用の `?v=20261014` を付けています。

## 確認事項

HTML/CSSのローカル参照、ページ内リンク、配信ファイルの一致を確認済みです。採用KVのSHA-256は以下です。

```text
7eae92c9b5a5398096bf663729caab1e509b4ddbfea10b95ac8d0bb3d929c277
```

問い合わせと提供エリア確認は、既存のZapier受信先を使う単一フォームです。提供エリアは住所・建物をもとに担当者が確認します。**本番フォームへの実送信テストは未実施です。** `no-cors` による送信のため、画面の完了表示だけではZapier側の受付結果を確認できません。

## 前LP（V1.0）と復旧

V1.0保存日: **2026-10-14**。保存タグ: **`v1.0`**。GitHub Release: [v1.0](https://github.com/wizao012/oshigoto-hikari.com/releases/tag/v1.0)。

前LPのV1.0はコミット [`9dc1ada675fe5a09900d1b84702f207b6baaa380`](https://github.com/wizao012/oshigoto-hikari.com/tree/9dc1ada675fe5a09900d1b84702f207b6baaa380) に保存されています。

V1.0へ戻す場合は、最新の `main` から復旧ブランチを作り、次の変更をPRとして `main` に反映します。過去の履歴は保持されます。

```sh
git switch main
git pull --ff-only origin main
git switch -c restore-v1.0
git restore --source=9dc1ada675fe5a09900d1b84702f207b6baaa380 --staged --worktree -- .
git commit -m "Restore LP V1.0"
git push -u origin restore-v1.0
```

PRをマージした後、GitHub Pagesの公開完了とドメインの表示を確認してください。履歴の詳細は `VERSION_HISTORY.md` を参照してください。
