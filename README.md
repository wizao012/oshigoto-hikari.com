# フレッツ 光クロス LP

承認済み v17 デザインの本番移管版。公開先は https://oshigoto-hikari.com/ です。

- GitHub Pages: main / root。CNAME・.nojekyll を維持。DNS変更なし。
- `/`: 法人・個人事業主。`/household/`: 全国個人。`/household/tokai/`: 東海個人。
- 初期用途モーダル。法人選択後だけ既存GTMを読み込み、法人フォーム送信処理完了時のみ lead_form_submit。電話・個人・未入力・エラーはCVなし。
- 3ルートは既存Zapier Webhookと既存campaign・フォーム項目名を維持。no-cors応答は下流の受信保証ではありません。メール受信と媒体診断は別途照合します。
- 個人は ads_conversion_eligible の文字列 false。サーバー側CVも business + 文字列 true の完全一致で絞り込む必要があります。
- UTM・クリックIDを保存し、新しいタグ付き流入は一式置換。google_keyword は検索語句ではなく登録キーワードです。
- 法人期限は2026年11月30日固定。家庭用はJST当月末。期限更新時は本文・PC表示も点検してください。
- 公開資料に準拠して電話・プライバシーポリシー・条件表記を反映。制作確認用の未確定注記は除去。
- WebP軽量画像・まとめたCSS・静的HTML。canonical/構造化データ/sitemapは3本番URL。

検証: `node --test *.test.cjs`。ネットワークはモックであり実受信検証とは別です。

確認用サイトは別配置の previewMode:true / businessMeasurementEnabled:false を維持してください。本番設定をプレビューへコピーしないでください。
