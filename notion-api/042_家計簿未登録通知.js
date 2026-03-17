const MainProcUnregisterdExpenseNotification = (function () {
  const IDX_COL_DATE = 0;
  const IDX_COL_METHOD_PAY = 1;
  const IDX_COL_AMOUNT = 2;
  const IDX_COL_NOTE = 3;

  /**
   * 検索条件を指定して検索します。
   * @return 検索結果
   */
  const executeSelect = () => {
    const filterItems = [
      new FilterItem(Constants.PROPERTY_SPENDING.TITLE, 'title', 'ends_with', '自動登録'),
      new FilterItem(Constants.PROPERTY_SPENDING.CHECKED, 'checkbox', 'equals', false),
    ];
    return LocalUtils.getPages(Props.getValue(PKeys.DATA_SOURCE_ID_SPENDING), new Filter(filterItems));
  }

  const pushMessage = (outData) => {
    const msgList = ['家計簿へ未登録です。'];
    for (const rowData of outData) {
      const msgs = [
        `日付：${rowData[IDX_COL_DATE]}`,
        `支払方法：${rowData[IDX_COL_METHOD_PAY]}`,
        `金額：${rowData[IDX_COL_AMOUNT].toLocaleString()}円`,
        `備考: ${rowData[IDX_COL_NOTE]}`,
        
      ];
      const msg = msgs.join('\n');
      Logger.log(msg);
      msgList.push(msg);
    }

    LineUtil.postText(Props.getValue(PKeys.LINE_CHANNEL_TOKEN), Props.getValue(PKeys.LINE_USER_ID), msgList.join('\n\n'));
  }

  return {
    execute: () => {
      const resultArray = executeSelect();
      if (resultArray.length === 0) {
        Logger.log('対象データなし');
        return false;
      }
      const outData = [];

      for (const result of resultArray) {
        const props = result.properties;
        const noteItem = props[Constants.PROPERTY_SPENDING.NOTE].rich_text[0];
        
        const rowData = [
          props[Constants.PROPERTY_SPENDING.DATE].date.start,
          props[Constants.PROPERTY_SPENDING.METHOD_PAY].select.name,
          props[Constants.PROPERTY_SPENDING.AMOUNT].number,
          noteItem ? noteItem.plain_text : '',
        ];
        
        outData.push(rowData);
      }
      // ソート
      const sortMap = new Map([
        [IDX_COL_DATE, true],
        [IDX_COL_AMOUNT, true],
      ]);
      LocalUtils.sort(outData, sortMap);
      // メッセージ通知
      pushMessage(outData);
      return true;
    },
  }
})();

/**
 * 家計簿未登録通知
 */
function UnregisterdExpenseNotification() {
  MainProcUnregisterdExpenseNotification.execute();
}