# おしごと光10G LP — GitHub Pages公開用

HTML・CSS・JavaScriptだけで動作する静的LPです。外部ライブラリ、ビルド、サーバーサイド処理は不要です。すべて相対パスのため、GitHub Pagesのリポジトリ配下でも表示できます。

## ローカル確認

`index.html` をブラウザで開いてください。モバイル幅432pxを基準に表示されます。

## GitHub Pagesで公開する手順

1. GitHubで新しいリポジトリを作成します。
2. このフォルダの**中身**を、リポジトリのルートへアップロードします。
3. GitHubの `Settings` → `Pages` を開きます。
4. `Build and deployment` のSourceで `Deploy from a branch` を選択します。
5. Branchを `main`、フォルダを `/(root)` にして保存します。
6. 公開処理完了後、`https://アカウント名.github.io/リポジトリ名/` で表示を確認します。

`.nojekyll` を同梱しているため、Jekyll変換を行わず静的ファイルをそのまま公開できます。

## 公開前に設定する項目

- Webhook: `index.html` 内の2つの `form` にある `data-webhook=""` にHTTPSの送信先URLを設定
- WebhookのCORS: GitHub Pagesの公開URLからのJSON POSTを許可
- GTM: `index.html` 内の2つの `GTM挿入位置` コメントへコードを追加
- 個人情報保護方針: 同意文言を正式なプライバシーポリシーURLへリンク
- 運営会社情報: 現在は `https://hikkoshi-1sp.jp/` へリンク
- SEO: 公開URL決定後、canonical、`og:url`、`og:image` を追加

## フォームの現在の挙動

- 必須項目と入力形式をブラウザ側で確認します。
- `data-webhook` が空の間は外部送信せず、準備中メッセージを表示します。
- Webhook設定後はJSONをPOSTします。`formType` と `submittedAt` も送信します。
- 実際の10G提供可否判定API、郵便番号検索API、判定結果画面は未接続です。

## 検索対策

- 店舗、インターネット、Wi-Fi、法人、光回線に関する説明をHTMLテキストで収録
- 全18問のFAQとFAQPage構造化データを収録
- 5問目以降は折りたたみ表示にしてページの長さを抑制

## 主なファイル

- `index.html`: LP本体、フォーム、構造化データ
- `styles.css`: モバイル表示用スタイル
- `script.js`: 入力確認とWebhook送信
- `assets/`: LP画像、ロゴ、ピカりん画像
- `.nojekyll`: GitHub Pages用設定
