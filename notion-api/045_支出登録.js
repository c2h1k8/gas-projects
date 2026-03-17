const MainProcRegist = (function () {
  const ROW_S = 3;
  const ROW_E = 100;
  const COL_CHECK = 2;
  const COL_TITLE = 3;
  const COL_CATEGORY = 4;
  const COL_DATE = 5;
  const COL_AMOUNT = 6;
  const COL_SHOP = 7;
  const COL_METHOD_PAY = 8;
  const COL_URL = 9;
  const COL_NOTE = 10;
  const COL_EXPENSE_RATIO = 11;
  return {
    regist: () => {
      // Sheet取得
      const sheet = SpreadsheetApp.getActiveSheet();
      const pageMap = new Map();;
      for (let i = ROW_S; i <= ROW_E; i++) {
        // チェックのない項目についてはスキップ
        if (!sheet.getRange(i, COL_CHECK).getValue()) continue;
        let title = sheet.getRange(i, COL_TITLE).getValue();
        if (!title) continue;
        const category = sheet.getRange(i, COL_CATEGORY).getValue();
        let date = sheet.getRange(i, COL_DATE).getValue();
        if (!date) date = new Date();
        const amount = sheet.getRange(i, COL_AMOUNT).getValue();
        const shop = sheet.getRange(i, COL_SHOP).getValue();
        const methodPay = sheet.getRange(i, COL_METHOD_PAY).getValue();
        const url = sheet.getRange(i, COL_URL).getValue();
        const note = sheet.getRange(i, COL_NOTE).getValue();
        const expenseRatio = sheet.getRange(i, COL_EXPENSE_RATIO).getValue();
        // iconと支出分割
        let icon = null;
        const startIdx = title.indexOf('(');
        if (startIdx > 0) {
          const strLength = title.indexOf(')') - startIdx - 1;
          icon = title.substr(startIdx + 1, strLength);
          title = title.substr(0, startIdx);
        }
        // 大カテゴリページID取得
        pageMap.set(i, LocalUtils.getCreateSpending({
          icon,
          title,
          date,
          category,
          amount,
          shop,
          methodPay,
          url,
          note,
          expenseRatio,
        }));
      }
      // 登録
      for (const [key, value] of pageMap) {
        const res = LocalUtils.createPage(value);
        console.log(res)
        if (res) continue;
        // 登録失敗したものは削除
        pageMap.delete(key)
      }
      // チェック解除
      for (const [key] of pageMap) {
        sheet.getRange(key, COL_CHECK).setValue(false);
      }
    }
  };
})();

function OnClickRegist() {
  return withLoading(function () {
    MainProcRegist.regist();
  }, { startHint: '登録中…', successHint: '登録完了！' });
}

