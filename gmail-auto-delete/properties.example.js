/**
 * 手動実行で設定する
 * 実際の値は properties.js に記載（git管理外）
 */
function setScriptProps() {
  const scriptProperties = PropertiesService.getScriptProperties();
  Logger.log(PropertiesService.getScriptProperties().getProperties());
  scriptProperties.deleteAllProperties();
  scriptProperties.setProperty('DEBUG_MODE', '0'); // 1: デバッグモード（削除しない）
  Logger.log(PropertiesService.getScriptProperties().getProperties());
}
