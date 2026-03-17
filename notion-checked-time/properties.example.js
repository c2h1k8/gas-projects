/**
 * 手動実行で設定する
 * 実際の値は properties.js に記載（git管理外）
 */
function setScriptProps() {
  Logger.log(Props.getAllValues());

  Props.setValue(PKeys.NOTION_VERSION, 'YOUR_NOTION_VERSION');
  Props.setValue(PKeys.NOTION_TOKEN, 'YOUR_NOTION_TOKEN');

  Props.setJson(PKeys.CHECK_ITEM_LIST, [
    {
      'DATABASE_ID': 'YOUR_NOTION_DATABASE_ID',
      'CHECKBOX_PROPERTY': 'YOUR_CHECKBOX_PROPERTY',
      'DATE_PROPERTY': 'YOUR_DATE_PROPERTY',
    },
  ]);

  Logger.log(Props.getAllValues());
}
