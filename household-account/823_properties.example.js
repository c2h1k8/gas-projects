/**
 * 手動実行で設定する
 * 実際の値は 823_properties.js に記載（git管理外）
 */
function setScriptProps() {
  Logger.log(Props.getAllValues());

  Props.setValue(PKeys.LINE_CHANNEL_TOKEN, 'YOUR_LINE_CHANNEL_TOKEN');
  Props.setValue(PKeys.LINE_USER_ID, 'YOUR_LINE_USER_ID');
  Props.setValue(PKeys.GEMINI_API_KEY, 'YOUR_GEMINI_API_KEY');
  Props.setValue(PKeys.GITHUB_TOKEN, 'YOUR_GITHUB_TOKEN');
  // 家計簿DB(money API)
  Props.setValue(PKeys.MONEY_API_URL, 'https://your-money-api.example.com');
  Props.setValue(PKeys.MONEY_API_TOKEN, 'YOUR_MONEY_API_TOKEN');

  // 家計簿自動登録設定リスト
  const autoRegistSettingList = [];
  Props.setJson(PKeys.AUTO_REGIST_SETTING_LIST, autoRegistSettingList);

  // MAIL_AI_ANALYZE_PROMPT は別途設定
  Logger.log(Props.getAllValues());
}
