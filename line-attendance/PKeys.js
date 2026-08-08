const PKeys = {
  /** Lineチャンネルトークン */
  LINE_CHANNEL_TOKEN: 'LINE_CHANNEL_TOKEN',
  /** LineユーザID */
  LINE_USER_ID: 'LINE_USER_ID',
  /** 勤務表シート名 */
  SHEET_NAME_MAIN: 'SHEET_NAME_MAIN',
  /** 勤務表ファイル名 */
  FILE_NAME: 'FILE_NAME',
  /** 最終提出済み勤務表 */
  LAST_SUBMIT_TIMESHEET: 'LAST_SUBMIT_TIMESHEET',
  /** 勤務表テンプレートファイルID */
  TEMPLATE_FILE_ID: 'TEMPLATE_FILE_ID',
  /** 勤務表出力ディレクトリ */
  OUTPUT_DIR_ID: 'OUTPUT_DIR_ID',
  /** 勤務表ファイルマップ */
  FILE_MAP: 'FILE_MAP',

  /** デフォルト出社時刻 */
  START_TIME_DEFAULT: 'START_TIME_DEFAULT',
  /** デフォルト退社時刻 */
  END_TIME_DEFAULT: 'END_TIME_DEFAULT',
  /** タイムカード丸め単位 */
  ROUND_UNIT: 'ROUND_UNIT',
  /** 計算用丸め単位 */
  ROUND_UNIT_CALC: 'ROUND_UNIT_CALC',

  /** 名字 */
  NAME_LAST: 'NAME_LAST',
  /** 名前 */
  NAME_FIRST: 'NAME_FIRST',
  /** 氏名（アルファベット） */
  NAME_ALPHA: 'NAME_ALPHA',
  /** 送信元 */
  ADDRESS_FROM: 'ADDRESS_FROM',
  /** 勤務表送信先 */
  ADDRESS_TO: 'ADDRESS_TO',
  /** 会社名 */
  COMPANY_NAME: 'COMPANY_NAME',
  /** 会社郵便番号 */
  COMPANY_POST_CD: 'COMPANY_POST_CD',
  /** 会社住所 */
  COMPANY_ADDRESS: 'COMPANY_ADDRESS',
  /** 会社電話番号 */
  COMPANY_TEL: 'COMPANY_TEL',
  /** 会社URL */
  COMPANY_URL: 'COMPANY_URL',
  /** デバッグ用メールアドレス */
  DEBUG_EMAIL: 'DEBUG_EMAIL',

  /** 月別合計/残業のキャッシュ（JSON: { yyyyMM: { total, overtime } }） */
  MONTH_SUMMARY_CACHE: 'MONTH_SUMMARY_CACHE',

  /** 勤怠開始/終了のLINE登録履歴（JSON Map: { 'yyyy-MM-dd': { start: bool, end: bool } }） */
  PUNCH_LOG: 'PUNCH_LOG',
  /** 週次サマリー送信済みの週と内容シグネチャ（JSON Map: { 'yyyy-MM-dd'(週の月曜): signature }。内容が変われば再送） */
  WEEKLY_SUMMARY_SENT: 'WEEKLY_SUMMARY_SENT',
  /** 勤務表が未作成の月に予約した休暇（JSON Map: { 'yyyy-MM-dd': 勤怠区分 }。勤務表作成時に反映して削除） */
  LEAVE_RESERVATIONS: 'LEAVE_RESERVATIONS',

  /** 入社日（'yyyy-MM-dd'。ここから有給を自動付与。未設定なら有休管理を行わず休暇は欠勤で登録） */
  PAID_LEAVE_JOIN_DATE: 'PAID_LEAVE_JOIN_DATE',
  /** 有給の付与テーブル（JSON: [{ months: 継続勤務月数, days: 付与日数 }]。初回=最小月数、以降1年ごと） */
  PAID_LEAVE_TABLE: 'PAID_LEAVE_TABLE',
  /** 有給の有効期間（年。時効。未設定なら2年） */
  PAID_LEAVE_EXPIRE_YEARS: 'PAID_LEAVE_EXPIRE_YEARS',
  /** 有給の消化順（'newest'=今期分から / 'oldest'=繰越分から。未設定なら'newest'） */
  PAID_LEAVE_USE_ORDER: 'PAID_LEAVE_USE_ORDER',
  /** 有休台帳（JSON: { grants: [{ date, days, expire, used }], used: { 'yyyy-MM-dd': 付与日 } }） */
  PAID_LEAVE_LEDGER: 'PAID_LEAVE_LEDGER',

  // ===== 勤怠の書き出し =====

  /** 登録した勤怠を書き出すJSONのファイルID。未設定なら書き出しを行わない */
  EXPORT_FILE_ID: 'EXPORT_FILE_ID',
};