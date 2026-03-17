/**
 * 手動実行で設定する
 * 実際の値は 823_properties.js に記載（git管理外）
 */
function setScriptProps() {
  Logger.log(Props.getAllValues());

  Props.setValue(PKeys.NOTION_VERSION, '2025-09-03');
  Props.setValue(PKeys.NOTION_TOKEN, 'YOUR_NOTION_TOKEN');
  Props.setValue(PKeys.LINE_CHANNEL_TOKEN, 'YOUR_LINE_CHANNEL_TOKEN');
  Props.setValue(PKeys.LINE_USER_ID, 'YOUR_LINE_USER_ID');
  Props.setValue(PKeys.GEMINI_API_KEY, 'YOUR_GEMINI_API_KEY');
  Props.setValue(PKeys.GITHUB_TOKEN, 'YOUR_GITHUB_TOKEN');
  Props.setValue(PKeys.DATA_SOURCE_ID_INCOME, 'YOUR_NOTION_DATABASE_ID_INCOME');
  Props.setValue(PKeys.DATA_SOURCE_ID_SPENDING, 'YOUR_NOTION_DATABASE_ID_SPENDING');

  // 家計簿自動登録設定リスト
  const autoRegistSettingList = [];
  Props.setMap(PKeys.AUTO_REGIST_SETTING_LIST, autoRegistSettingList);

  // MAIL_AI_ANALYZE_PROMPT は別途設定
  Logger.log(Props.getAllValues());
}
