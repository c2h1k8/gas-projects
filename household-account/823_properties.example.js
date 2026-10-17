/**
 * 手動実行で設定する
 * 実際の値は 823_properties.js に記載（git管理外）
 */
function setScriptProps() {
  Logger.log(Props.getAllValues());

  Props.setValue(PKeys.LINE_CHANNEL_TOKEN, 'YOUR_LINE_CHANNEL_TOKEN');
  Props.setValue(PKeys.LINE_USER_ID, 'YOUR_LINE_USER_ID');
  Props.setValue(PKeys.GEMINI_API_KEY, 'YOUR_GEMINI_API_KEY');
  // 家計簿DB(money API)
  Props.setValue(PKeys.MONEY_API_URL, 'https://your-money-api.example.com');
  Props.setValue(PKeys.MONEY_API_TOKEN, 'YOUR_MONEY_API_TOKEN');

  // 家計簿自動登録設定リスト
  const autoRegistSettingList = [];
  Props.setJson(PKeys.AUTO_REGIST_SETTING_LIST, autoRegistSettingList);

  // FX の約定メール自動登録（049_FX約定登録.js）。検索条件と、本文から読む項目名・単位・通貨名
  Props.setJson(PKeys.FX_FILL_SETTING, {
    // 対象＝Gmail のラベル「FX」の、スター付きの約定のお知らせ（登録できたらスターを外す）
    SEARCH_WORD: 'label:FX subject:注文約定のお知らせ is:starred',
    // 本文「■ 約定内容」の「項目 : 値」の項目名
    FIELDS: { PAIR: '通貨ペア', SIDE: '売買', QTY: '取引数量', PRICE: '約定価格', ORDER: '注文番号' },
    SIDE_BUY: '買',
    SIDE_SELL: '売',
    // 取引数量 ÷ LOT_UNIT ＝ Lot（DMM FX は 1 Lot = 1万通貨）
    LOT_UNIT: 10000,
    // メールの通貨名 → 通貨記号（半角カナは NFKC で全角に揃えてから引く）。money へは "USD/JPY" の名前で送る
    CURRENCY: { '米ドル': 'USD', 'ユーロ': 'EUR', '英ポンド': 'GBP', 'ポンド': 'GBP', '豪ドル': 'AUD', '南アランド': 'ZAR', 'ランド': 'ZAR', '円': 'JPY' },
  });

  // MAIL_AI_ANALYZE_PROMPT は別途設定
  Logger.log(Props.getAllValues());
}
