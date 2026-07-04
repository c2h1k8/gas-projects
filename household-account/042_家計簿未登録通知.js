const MainProcUnregisterdExpenseNotification = (function () {
  const IDX_COL_DATE = 0;
  const IDX_COL_METHOD_PAY = 1;
  const IDX_COL_AMOUNT = 2;
  const IDX_COL_NOTE = 3;

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
      // money API の未確認(CONFIRMED=0)支出を通知対象にする
      const items = MoneyApi.listUnconfirmed('spending');
      if (items.length === 0) {
        Logger.log('対象データなし');
        return false;
      }
      const outData = items.map((it) => [
        it.date,
        it.method_pay || '',
        it.amount,
        it.note || '',
      ]);
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