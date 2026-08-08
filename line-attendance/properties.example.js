/**
 * 手動実行で設定する
 * 実際の値は properties.js に記載（git管理外）
 */
function setScriptProps() {
  Logger.log(Props.getAllValues());
  Props.setValues({
    [PKeys.FILE_NAME]: 'YOUR_FILE_NAME',
    [PKeys.OUTPUT_DIR_ID]: 'YOUR_OUTPUT_DIR_ID',
    [PKeys.TEMPLATE_FILE_ID]: 'YOUR_TEMPLATE_FILE_ID',
    [PKeys.ADDRESS_FROM]: 'YOUR_ADDRESS_FROM',
    [PKeys.ADDRESS_TO]: JSON.stringify(['YOUR_ADDRESS_TO']),
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
    // 有給休暇（入社日を設定すると自動付与。未設定なら有休管理を行わず休暇は欠勤で登録）
    [PKeys.PAID_LEAVE_JOIN_DATE]: 'YOUR_JOIN_DATE', // 'yyyy-MM-dd'
    [PKeys.PAID_LEAVE_EXPIRE_YEARS]: 2,
    [PKeys.PAID_LEAVE_USE_ORDER]: 'newest', // 消化順: 'newest'=今期分から / 'oldest'=繰越分から
    // 継続勤務月数→付与日数。初回は最小月数の時点で付与し、以降は1年ごと。
    // 最終行を超えた勤続は最終行の日数が続く。
    [PKeys.PAID_LEAVE_TABLE]: JSON.stringify([
      { months: 6, days: 10 },   // 6ヶ月
      { months: 18, days: 11 },  // 1年6ヶ月
      { months: 30, days: 12 },  // 2年6ヶ月
      { months: 42, days: 14 },  // 3年6ヶ月
      { months: 54, days: 16 },  // 4年6ヶ月
      { months: 66, days: 18 },  // 5年6ヶ月
      { months: 78, days: 20 },  // 6年6ヶ月以上
    ]),
    [PKeys.LINE_CHANNEL_TOKEN]: 'YOUR_LINE_CHANNEL_TOKEN',
    [PKeys.LINE_USER_ID]: 'YOUR_LINE_USER_ID',
    [PKeys.DEBUG_EMAIL]: 'YOUR_DEBUG_EMAIL',
  });
  Logger.log(Props.getAllValues());
}
