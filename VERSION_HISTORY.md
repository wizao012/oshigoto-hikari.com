# バージョン履歴

V1.0保存日: **2026-10-14**。保存タグ: **`v1.0`**。GitHub Release: [v1.0](https://github.com/wizao012/oshigoto-hikari.com/releases/tag/v1.0)。

リポジトリ: https://github.com/wizao012/oshigoto-hikari.com

配信ドメイン: https://oshigoto-hikari.com/

| バージョン | 内容 | 保存先 |
| --- | --- | --- |
| V1.0（前LP） | 最大7万円キャッシュバックを案内する前LP | [`9dc1ada675fe5a09900d1b84702f207b6baaa380`](https://github.com/wizao012/oshigoto-hikari.com/tree/9dc1ada675fe5a09900d1b84702f207b6baaa380) |
| ワンコインキャンペーン版 | 12ヶ月間 実質月額500円（税抜）。採用KVを保持し、下段をコンテンツとして構成。詳細・適用条件は初期閉アコーディオン | [`72663e3421fbe6117b84eae6469c2fa715e00490`](https://github.com/wizao012/oshigoto-hikari.com/tree/72663e3421fbe6117b84eae6469c2fa715e00490) |
| ワンコイン・PC中央カラム版（2026-10-14） | 採用した業務別デザインと指定見出しへ変更。PCの中央にスマホ版、左右に訴求・メニュー・CTAを配置 | この更新コミット |

採用KVのSHA-256: `7eae92c9b5a5398096bf663729caab1e509b4ddbfea10b95ac8d0bb3d929c277`

本番フォームへの実送信テストは未実施です。既存のZapier受信先を維持しており、`no-cors` 送信の画面完了表示だけでは受信成否を確認できません。

## V1.0へ復旧する方法

最新の `main` から復旧ブランチを作り、下記の変更をPR経由で `main` に反映します。GitHub Pagesの公開完了後、ドメインの表示を確認してください。

```sh
git switch main
git pull --ff-only origin main
git switch -c restore-v1.0
git restore --source=9dc1ada675fe5a09900d1b84702f207b6baaa380 --staged --worktree -- .
git commit -m "Restore LP V1.0"
git push -u origin restore-v1.0
```

この方法は過去のコミット履歴を保持します。配信ファイルの構成と確認事項は `README.md` に記載しています。
