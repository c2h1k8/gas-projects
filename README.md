# gas-projects

Google Apps Script（GAS）で作成した個人用自動化ツール群を、[clasp](https://github.com/google/clasp) でローカル管理しているモノレポです。LINE Bot・Notion・Gmail・スプレッドシートを組み合わせ、勤怠管理や家計簿などの日常タスクを自動化しています。

各プロジェクトは独立した GAS プロジェクトで、共通コードは `common/` / `notion-common/` で一元管理し、`scripts/copy-common.sh` で各プロジェクトへコピーして利用します。

## 構成

```
gas-projects/
├── common/              # 全プロジェクト共通ユーティリティ（コピー元）
├── notion-common/       # Notion 連携共通モジュール（コピー元）
├── scripts/             # 共通コードのコピースクリプト
│
├── line-attendance/     # LINE Bot による勤怠管理
├── household-account/   # 家計簿（money API + LINE + AI）
├── notion-checked-time/ # Notion チェック日時の自動記録
├── gmail-auto-delete/   # Gmail 自動削除
└── line-messaging-api/  # LINE Messaging API ラッパー（GAS ライブラリ）
```

## プロジェクト一覧

### line-attendance — LINE 勤怠管理 Bot
LINE のトークでメッセージを送るだけで、勤務表スプレッドシートへの打刻・集計・提出までを行う Bot です。

- **打刻 / 勤怠登録**: `1930`（退社）, `1102 1931`（出社・退社）, `1日 1900`（日付指定）など柔軟な入力形式に対応。勤怠区分（欠勤 `r` / 有給 `h` / 代休 `d` / 休日出勤 `w` / クリア `c`）も指定可能
- **時刻丸め**: 設定単位での出退社時刻の切り上げ／切り捨て
- **勤怠一覧表示**: `リスト` で当月の稼働・合計・見込み・残業時間を表示（`リスト 1` で前月など）
- **勤務表提出**: Excel 形式に変換してメール送信、翌月勤務表の自動作成
- **勤怠連絡メール**: 欠勤・客先休・遅刻・早退・休日出勤などの連絡メールを自動送信。`休 yyyymmdd 本文` のテキスト形式や、LINE のカレンダー UI（datetimepicker）からの入力に対応
- **テストモード**: `TestRunner.js` の `test_*` 関数を GAS エディタから実行すると、スプレッドシートへの書き込みをスキップしてモックで動作確認できる

エントリポイント: `doPost`（LINE Webhook）

### household-account — 家計簿管理（money API + LINE + AI）
自前の money API（家計簿 DB）を収支データベースとし、スプレッドシートを操作画面として管理します。新規の支出／収入は money API へ「未確認（`CONFIRMED=0`）」で登録し、money 側の画面で確認・確定するまで本体集計には反映されません。メールからの AI 自動登録機能を備えています。

- **支出登録 / 更新 / 削除**: スプレッドシートのボタンから money API へ反映（`OnClickRegist`, `OnClickSearchSpending`, `OnClickUpdateSpending` ほか）
- **収入登録 / 更新 / 削除**: 同上（`OnClickSearchIncome`, `OnClickUpdateIncome` ほか）
- **固定費自動登録**: 営業日・指定日基準で固定費を money API に自動登録（`CreateFixedCost`）
- **メール AI 自動登録**: 受信メールを Gemini で解析し、個人情報をマスクしたうえで家計簿に自動登録（`CreateHouseholdAccountFromMailAI`）
- **未登録通知 / タスク通知**: 家計簿の未登録項目や GitHub Projects の期限タスクを LINE へ通知（`UnregisterdExpenseNotification`, `sendLine`）
- **マスタ更新**: 入力規則用リストの更新（`OnClickUpdateDataValidationList`）

カテゴリ / お店 / 支払方法は「名前」で送信し、money API 側が既存マスタからコードを解決します（無ければ NULL＝確定時に割当）。連携ロジックは `048_家計簿DB連携.js`（`MoneyApi`）に集約。`MONEY_API_URL` / `MONEY_API_TOKEN`（スクリプトプロパティ）が未設定なら送信をスキップし、安全に無効化できます。

依存ライブラリ: `LineUtil`, `Parser`

### notion-checked-time — Notion チェック日時の自動記録
Notion DB で「チェックボックスが ON かつ日付が空」のページを検索し、現在日時を日付プロパティに自動記録します。複数 DB を `CHECK_ITEM_LIST` で設定可能。

エントリポイント: `UpdateCheckedTime`（時間主導型トリガー想定）

### gmail-auto-delete — Gmail 自動削除
スプレッドシートの「設定」シートに記載した条件（件名・差出人・宛先・ラベル・既読/未読・スター・受信からの経過日数など）から Gmail 検索クエリを組み立て、該当メールをゴミ箱へ移動します。除外条件（NOT）にも対応。

`DEBUG_MODE = '1'` のときは削除せず、対象メールをログ出力のみ行います。

エントリポイント: `AutoDeleteMail`（時間主導型トリガー想定）

### line-messaging-api — LINE Messaging API ラッパー
LINE Messaging API（テキスト・スタンプ・確認/ボタン/カルーセルテンプレート・クイックリプライ・絵文字）を扱うための GAS ライブラリです。他プロジェクトから `LineUtil` として参照されます。

`reply` / `push` の両系統と、各メッセージ種別のデータ生成ヘルパーを提供します。

## 共通モジュール

### `common/`
| ファイル | 役割 |
| --- | --- |
| `Props.js` | `PropertiesService` のラッパー（Map 対応・キャッシュ付き）。設定値の読み書き |
| `CoreUtils.js` | Map 対応の JSON シリアライズ／パースなど汎用ユーティリティ |
| `DateUtils.js` | 営業日判定・日付フォーマット（Google 祝日カレンダー参照） |
| `GoogleApi.js` | メール送信・Gemini API 連携など Google サービスのラッパー |
| `SpreadUtils.js` | スプレッドシートの最終行・最終列取得などのヘルパー |
| `LockUtil.js` | キャッシュベースの簡易排他ロック |
| `HtmlUtils.js` | HTML テキスト解析ヘルパー |
| `LoadingUi.js` / `Loading.html` | スプレッドシート上のローディング UI |

### `notion-common/`
| ファイル | 役割 |
| --- | --- |
| `NotionApi.js` | Notion API クライアント（ページ検索・更新など） |
| `NotionPayload.js` | Notion プロパティ／フィルタ／ページ構築用クラス群 |

## セットアップ

### 前提
- [clasp](https://github.com/google/clasp) のインストールとログイン（`clasp login`）
- 各プロジェクトに `.clasp.json`（スクリプト ID 設定、git 管理外）が必要

### 1. 共通コードのコピー
`common/` / `notion-common/` を変更したら、各プロジェクトへ反映します。

```bash
bash scripts/copy-common.sh
```

どの共通ファイルをどのプロジェクトへコピーするかは `scripts/copy-common.sh` 内で定義しています。

### 2. プロパティ（シークレット）の設定
各プロジェクトには `properties.example.js`（例: household-account は `823_properties.example.js`）があり、`setScriptProps` 関数で必要なスクリプトプロパティを設定する雛形を示しています。

1. `properties.example.js` を `properties.js` にコピー
2. `YOUR_xxx` を実際の値（LINE トークン・Notion トークン・Gemini API キー・各種 ID など）に置換
3. GAS エディタで `setScriptProps` を手動実行してスクリプトプロパティに登録

`properties.js`（実値）と `.clasp.json` は `.gitignore` により git 管理外です。

### 3. GAS へのアップロード
対象プロジェクトのディレクトリで実行します。

```bash
cd line-attendance
clasp push
```

## 開発フロー

`CLAUDE.md` に定めた手順に従います。

1. **GAS エディタへ反映**: `common/` / `notion-common/` を変更した場合は先に `scripts/copy-common.sh` を実行 → 各プロジェクトで `clasp push`
2. **動作確認**: ユーザーが GAS エディタまたは実動作で確認
3. **コミット / プッシュ**: 明示的な指示後に実行

## 技術スタック
- Google Apps Script（V8 ランタイム）
- clasp（ローカル開発・デプロイ）
- LINE Messaging API
- Notion API
- Gemini API（メール解析）
- タイムゾーン: `Asia/Tokyo`
