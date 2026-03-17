const isDebug = false;

/**
 * 手動実行で設定する
 * 実際の値は properties.js に記載（git管理外）
 */
function setScriptProps() {
  Logger.log(Props.getAllValues());
  const toAddress = [];
  const toAddressRest = [];
  if (isDebug) {
    toAddress.push('YOUR_DEBUG_ADDRESS');
    toAddressRest.push('YOUR_DEBUG_ADDRESS_REST');
  } else {
    toAddress.push('YOUR_ADDRESS_TO');
    toAddressRest.push('YOUR_ADDRESS_TO_FOR_REST');
  }

  Props.setValues({
    [PKeys.FILE_NAME]: 'YOUR_FILE_NAME',
    [PKeys.OUTPUT_DIR_ID]: 'YOUR_OUTPUT_DIR_ID',
    [PKeys.TEMPLATE_FILE_ID]: 'YOUR_TEMPLATE_FILE_ID',
    [PKeys.ADDRESS_FROM]: 'YOUR_ADDRESS_FROM',
    [PKeys.ADDRESS_TO]: JSON.stringify(toAddress),
    [PKeys.ADDRESS_TO_FOR_REST]: JSON.stringify(toAddressRest),
    [PKeys.NAME_LAST]: 'YOUR_NAME_LAST',
    [PKeys.NAME_FIRST]: 'YOUR_NAME_FIRST',
    [PKeys.NAME_ALPHA]: 'YOUR_NAME_ALPHA',
    [PKeys.COMPANY_NAME]: 'YOUR_COMPANY_NAME',
    [PKeys.COMPANY_POST_CD]: 'YOUR_COMPANY_POST_CD',
    [PKeys.COMPANY_ADDRESS]: 'YOUR_COMPANY_ADDRESS',
    [PKeys.COMPANY_TEL]: 'YOUR_COMPANY_TEL',
    [PKeys.COMPANY_URL]: 'YOUR_COMPANY_URL',
    [PKeys.SHEET_NAME_MAIN]: 'YOUR_SHEET_NAME_MAIN',
    [PKeys.START_TIME_DEFAULT]: '9:30',
    [PKeys.END_TIME_DEFAULT]: '18:30',
    [PKeys.ROUND_UNIT]: 0,
    [PKeys.ROUND_UNIT_CALC]: 30,
    [PKeys.LINE_CHANNEL_TOKEN]: 'YOUR_LINE_CHANNEL_TOKEN',
    [PKeys.LINE_USER_ID]: 'YOUR_LINE_USER_ID',
  });
  Logger.log(Props.getAllValues());
}
