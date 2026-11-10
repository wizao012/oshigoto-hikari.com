# おしごと光10G LP

法人・店舗向け「12ヶ月間 実質月額500円（税抜）」ワンコインキャンペーンの静的LPです。採用KVを主軸に、下段は説明・利用シーン・料金・品質・導入フローをコンテンツとして構成しています。キャンペーンの内訳と適用条件は、初期状態が閉じたアコーディオンに収録しています。

## 2026-11-10 法人・個人の振り分けと家庭向けLP

入口で法人・個人事業主（店舗・オフィス・登記先のご自宅）と、個人・家庭用を選択します。個人は地域を選び、全国版 `/household/` または東海版 `/household/tokai/` へ遷移します。全国は6ヶ月実質月額500円（税抜）、東海は6ヶ月実質月額0円＋3万円キャッシュバックです。個人にWiFi同時申込条件は適用しません。具体的な対象県・未確認の受取条件は補完していません。

- `audience-config.js` は本番設定（`previewMode:false` / `businessMeasurementEnabled:true`）です。GTMは法人を選択した後だけ読み込みます。
- 法人は送信処理が完了した場合のみ `lead_form_submit` を発火し、電話クリックは広告CVを発火しません。個人ページはGTM・Meta Pixel・Google広告タグを読み込まず、個人フォームもCVイベントを発火しません。
- 3フォームとも既存の同一Webhookを使用します。`audience_type` は `business` / `personal`、`audience_label` は「法人・個人事業主」/「個人」、`campaign_route` は `business` / `nationwide` / `tokai`、`ads_conversion_eligible` は法人 `true`、個人 `false` です。
- 個人も氏名・電話・メール・流入UTM等をトップレベルの項目で送り、会社名の追加入力は求めません。重複送信防止・通信失敗表示を実装しています。
- 家庭用の申込期限は日本時間の当月末を表示します。画像は価格訴求・家族背景に使用し、見出し・日付・条件・CTA・FAQはHTMLです。
- プレビュー用の検索除外設定は公開ファイルから除去し、個人2ページのcanonicalとsitemapを追加しました。元の未公開プレビューは別フォルダで送信停止設定のまま保持しています。

検証: `node --test attribution.test.cjs audience-router.test.cjs household-form.test.cjs`（36件）。通信はモック化しています。別途2026-11-10にダミーデータで共通WebhookのHTTP 200 / successを確認し、ユーザーが法人と全国個人A/Bの通知受信を確認しました。東海再テストはWebhook受付成功まで確認しています。`no-cors` のためブラウザの完了表示だけで通知メール到達を保証するものではありません。Zapier・Google/Metaアカウント側の外部CV連携設定は変更していません。

以下は従来LPの構成・過去の検証記録です。

- リポジトリ: https://github.com/wizao012/oshigoto-hikari.com
- 配信ドメイン: https://oshigoto-hikari.com/
- GitHub Pages配信ファイルはリポジトリのルートに配置します。ビルドは不要です。
- `CNAME` は `oshigoto-hikari.com`、`.nojekyll` は静的ファイル配信用です。
- `index.html`、CSS、`attribution.js`、`app.js` と、これらから参照する画像を配信します。`attribution.test.cjs` はNode.jsで実行する検証用ファイルです。
- 配信ファイルは同一階層です。画像は `media-*.png` / `media-*.webp` の名前で配信します。
- CSS・JavaScript参照にはキャッシュ更新用の `?v=...` を付けています。

## 確認事項

HTML/CSSのローカル参照、ページ内リンク、配信ファイルの一致を確認済みです。採用KVのSHA-256は以下です。

```text
7eae92c9b5a5398096bf663729caab1e509b4ddbfea10b95ac8d0bb3d929c277
```

問い合わせと提供エリア確認は、既存のZapier受信先を使う単一フォームです。提供エリアは住所・建物をもとに担当者が確認します。**本番フォームへの実送信テストは未実施です。** `no-cors` による送信のため、画面の完了表示だけではZapier側の受付結果を確認できません。

## 2026-10-20 広告流入パラメータ

問い合わせ・提供エリア確認の両方で、URLから取得した次の値を既存の送信データに追加します。

- `utm_source`、`utm_medium`、`utm_campaign`、`utm_term`、`utm_content`
- `keyword`、`google_keyword`、`campaign_id`、`adgroup_id`、`ad_id`、`adset_id`
- `matchtype`、`network`、`device`、`placement`、`site_source_name`
- `gclid`、`gbraid`、`wbraid`、`fbclid`

同一タブのsessionStorageへ保存するため、ページ内移動・パラメータのない再読み込み・フォームの再入力でも保持します。新しい広告パラメータ付きで訪問すると、以前の媒体の情報を残さず一式を置き換えます。ストレージが使えない場合も現在のページの値を送信できます。未指定の項目は空欄で、GoogleやMetaの流入を推測して補完しません。通常のフォーム内容に加え、上記の許可したURL項目のみを取得します。

Google広告の「最終ページURLのサフィックス」設定例（先頭の `?` は不要）：

```text
utm_source=google&utm_medium=cpc&utm_campaign={campaignid}&utm_term={keyword}&utm_content={creative}&adgroup_id={adgroupid}
```

`utm_campaign` はキャンペーンIDの代わりに任意の固定名も指定できます。`google_keyword` はGoogle流入の `utm_term` を優先し、空欄なら `keyword` を使います。ValueTrackの `{keyword}` はマッチした登録キーワードであり、実際の検索語句ではありません。キーワードを使わない配信では空欄になることがあります。[Google公式説明](https://support.google.com/google-ads/answer/6305348?hl=ja)

Meta広告の「URLパラメーター」設定例（`onecoin_10g` は任意のキャンペーン名へ変更）：

```text
utm_source=meta&utm_medium=paid_social&utm_campaign=onecoin_10g
```

広告アカウント側のURL設定は別途必要です。Zapierの後続ステップで通知やCRMにも表示する場合は、受信データの追加項目をマッピングしてください。商品説明用の既存 `campaign` と広告用の `utm_campaign` は別項目です。

検証：`node --test attribution.test.cjs`。実ブラウザーではGTMを外し送信先をローカル受信専用URLへ差し替えた環境で、Google相談・Googleエリア確認・Meta相談の送信データを確認しました。本番のZapierにテストリードは送信していません。

## 2026-10-23 電話導線・見出し・FAQの更新

スマホ下部の固定CTAとPC右側に「電話で聞いてみる」を配置し、問い合わせフォームの前に電話番号050-1780-2661を掲載しました。電話カードが見える間はスマホの固定CTAを隠し、フォーム入力中には再表示します。フォームと広告パラメータの送信処理・受信先は維持しています。

KV直下は小さなサービス紹介帯にし、比較・端末セクションなどの見出しと説明をHTMLで掲載しています。FAQは主要4問と、折りたたんだ追加12問の構成です。電話導線は`phone-cta.css`、見出し・本文の仕上げは`content-text.css`で調整します。

確認：スマホ320px・390pxおよびPC1280pxでの表示、ページ内リンク、電話リンク、FAQの開閉、広告パラメータの13件のテスト。本番フォームの実送信・実際の発信は行っていません。

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

## 2026-10-14 デザイン更新

端末セクションは採用した業務別の画像に変更し、見出しを「お仕事で使う端末を、まとめて１０Gへ」に更新しました。PCでは中央のスマホと同じ単列コンテンツを、左のキャンペーン訴求・右のメニュー／問い合わせCTAで挟みます。画面幅1120px以上で左右が追従し、狭い画面では中央のみを表示します。PCレイアウトは`desktop-layout.css`、見出し・料金の仕上げは最後に読み込む`typography.css`で調整します。

## 2026-10-14 文字・料金配置の調整

PCの左右レールは全体最大1344pxに広げ、キャッチ、料金、メニュー、CTAを拡大しました。中央のネイティブ見出しと説明文は中央寄せにし、見出しへ短い青・黄色のラインを追加。キャンペーン料金は「12ヶ月間・実質月額」の下に500円を配置しています。
