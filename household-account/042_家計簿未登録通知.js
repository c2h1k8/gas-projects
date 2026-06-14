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
      new NotionFilterItem(Constants.PROPERTY_SPENDING.TITLE, 'title', 'ends_with', '自動登録'),
      new NotionFilterItem(Constants.PROPERTY_SPENDING.CHECKED, 'checkbox', 'equals', false),
    ];
    return NotionApi.getPages(Props.getValue(PKeys.DATA_SOURCE_ID_SPENDING), new NotionFilter(filterItems));
  }

  const pushMessage = (outData) => {
    const rows = outData.map((rowData) => {
      const method = rowData[IDX_COL_METHOD_PAY];
      const note = rowData[IDX_COL_NOTE];
      return {
        date: rowData[IDX_COL_DATE],
        amount: rowData[IDX_COL_AMOUNT],
        sub: note ? `${method}・${note}` : method,
      };
    });
    LocalUtils.postFlex('家計簿 未登録', NotifyCards.unregistered(rows));
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
      CoreUtils.sort(outData, sortMap);
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