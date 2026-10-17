const PKeys = {
  /** Lineチャンネルトークン */
  LINE_CHANNEL_TOKEN: 'LINE_CHANNEL_TOKEN',
  /** LineユーザID */
  LINE_USER_ID: 'LINE_USER_ID',

  /** 自動登録設定 */
  AUTO_REGIST_SETTING_LIST: 'AUTO_REGIST_SETTING_LIST',

  /** Gemini Apiキー */
  GEMINI_API_KEY: 'GEMINI_API_KEY',
  /** メール解析用プロンプト */
  MAIL_AI_ANALYZE_PROMPT: 'MAIL_AI_ANALYZE_PROMPT',
  /** メール解析用マスク情報（JSON） */
  MAIL_AI_MASK: 'MAIL_AI_MASK',

  /** 家計簿DB(money API) のベースURL 例: https://your-money-api.example.com */
  MONEY_API_URL: 'MONEY_API_URL',
  /** 家計簿DB(money API) の Bearer トークン */
  MONEY_API_TOKEN: 'MONEY_API_TOKEN',

  /** FX 約定メールの自動登録設定（JSON: 検索条件・本文の項目名・Lot の単位・通貨名） */
  FX_FILL_SETTING: 'FX_FILL_SETTING',

  /** 選択肢の使用回数（JSON: { cat: {名前:回数}, pay: {名前:回数} }） */
  SELECT_USAGE: 'SELECT_USAGE',
};