/**
 * 手動実行で設定する
 * 実際の値は properties.js に記載（git管理外）
 */
function setScriptProps() {
  Logger.log(Props.getAllValues());
  Props.setValue(PKeys.DEBUG_MODE, '0'); // 1: デバッグモード（削除しない）
  Logger.log(Props.getAllValues());
}
