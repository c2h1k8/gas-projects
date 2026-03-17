const MainProcFixedCost = (function () {
  const SHEET_NAME = '固定費自動登録';
  const ROW_HEADER = 2;
  const ROW_DATA = 3;
  const COL_TYPE = 2;
  const IDX_COL_TYPE = 0;
  const IDX_COL_MONTH = 1;
  const IDX_COL_DAY = 2;
  const IDX_COL_BIZ_PREV = 3;
  const IDX_COL_BIZ_NEXT = 4;
  const IDX_COL_ICON = 5;
  const IDX_COL_TITLE = 6;
  const IDX_COL_CATEGORY = 7;
  const IDX_COL_AMOUNT = 8;
  const IDX_COL_SHOP = 9;
  const IDX_COL_METHOD_PAY = 10;
  const IDX_COL_NOTE = 11;
  const IDX_COL_EXPENSE_RATIO = 12;

  const getData = () => {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    const rowCnt = Utils.getEndRow(sheet, COL_TYPE) - ROW_HEADER;
    const colCnt = Utils.getEndCol(sheet, ROW_HEADER) - COL_TYPE + 1;
    if (rowCnt === 0) {
      return undefined;
    }
    return sheet.getRange(ROW_DATA, COL_TYPE, rowCnt, colCnt).getValues();
  }

  const isRegistMonth = (targetMonths) => {
    if (!targetMonths) {
      // 対象月が未設定の場合、登録対象月
      return true;
    }
    const currentMonth = new Date().getMonth() + 1;
    if (typeof targetMonths === 'number') {
      // 単月の場合
      return targetMonths === currentMonth;
    }

    if (targetMonths.split(',').includes(currentMonth.toString())) {
      // 複数月で対象月に含まれる場合、登録対象月
      return true;
    }
    return false;
  }

  const isRegistDate = (day, isBizPrev, isBizNext) => {
    const now = new Date();
    let date = new Date(now.getFullYear(), now.getMonth(), day);
    if (date.getMonth() !== now.getMonth()) {
      // 存在しない日の場合、最終日を設定
      date = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }
    if (isBizPrev) {
      // 前営業日の場合、前営業日を設定
      date = DateUtils.getBizDatePrev(date);
    }
    if (isBizNext) {
      // 翌営業日の場合、翌営業日を設定
      date = DateUtils.getBizDateNext(date);
    }
    return now.getDate() === date.getDate();
  }

  return {
    regist: () => {
      const datas = getData();
      if (!datas) {
        Logger.log('登録データがありません。');
        return;
      }

      const now = new Date();

      const msgList = [];
      for (const data of datas) {
        // 対象月判定
        if (!isRegistMonth(data[IDX_COL_MONTH])) {
          Logger.log(`月対象外: ${data[IDX_COL_TITLE]}`);
          continue;
        }
        // 対象日判定
        if (!isRegistDate(data[IDX_COL_DAY], data[IDX_COL_BIZ_PREV], data[IDX_COL_BIZ_NEXT])) {
          Logger.log(`日対象外: ${data[IDX_COL_TITLE]}`);
          continue;
        }
        const icon = data[IDX_COL_ICON];
        const title = data[IDX_COL_TITLE];
        const category = data[IDX_COL_CATEGORY];
        const amount = data[IDX_COL_AMOUNT];
        const shop = data[IDX_COL_SHOP];
        const methodPay = data[IDX_COL_METHOD_PAY];
        const note = data[IDX_COL_NOTE];
        const expenseRatio = data[IDX_COL_EXPENSE_RATIO];
        let page;
        switch (data[IDX_COL_TYPE]) {
          case '収入':
            page = LocalUtils.getCreateIncome({
              'icon': icon,
              'title': title,
              'date': now,
              'amount': amount,
            });
            break;
          case '支出':
            page = LocalUtils.getCreateSpending({
              icon,
              title,
              'date': now,
              category,
              amount,
              shop,
              methodPay,
              note,
              expenseRatio,
            });
            break;
          default:
            continue;
        }
        const res = LocalUtils.createPage(page);
        if (res) {
          msgList.push(`- ${title} ${amount.toLocaleString()}円`);
        }
      }

      if (msgList.length) {
        msgList.unshift('以下の項目を家計簿に登録しました$')
        LocalUtils.postText(msgList, [LineUtil.getEmojiJson('5ac21cc5031a6752fb806d5c', '126')]);
      }
    },
    error: (e) => {
      if (e instanceof DbNotFoundException) {
        LocalUtils.postText(e.message);
        return;
      }
      throw e;
    },
  };
})();

/**
 * 固定費登録
 */
function CreateFixedCost() {
  try {
    MainProcFixedCost.regist();
  } catch (e) {
    MainProcFixedCost.error(e);
  }
}
