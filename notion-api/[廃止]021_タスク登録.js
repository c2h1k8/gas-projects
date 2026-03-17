const MODE_AUTO = 1;
const MODE_MAN = 2;
const MainProcAutoTodo = (function () {
  const ROW_HEADER = 2;
  const ROW_DATA = 3;
  const COL_MAN = 2;
  const IDX = {
    MANUAL: 0,
    AUTO: 1,
    REPEAT: 2,
    MONTH: 3,
    DAY: 4,
    DAY_OF_WEEK: 5,
    CUSTOM_WEEK: 6,
    CUSTOM_DAY_OF_WEEK: 7,
    PREV_BIZ: 8,
    NEXT_BIZ: 9,
    TAG: 10,
    TITLE: 11,
  }
  
  /**
   * 登録データを取得します。
   * @param mode 登録モード
   * @return 登録データJSON配列
   */
  const getRegData = (mode) => {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('タスク登録');
    const rowCnt = Utils.getEndRow(sheet, COL_MAN) - ROW_HEADER;
    const colCnt = Utils.getEndCol(sheet, ROW_HEADER) - COL_MAN + 1;
    if (rowCnt === 0) {
      return undefined;
    }
    const rng = sheet.getRange(ROW_DATA, COL_MAN, rowCnt, colCnt);
    // モードによって登録対象チェック列を切り替え
    let idxMode;
    switch (mode) {
      case MODE_AUTO:
        idxMode = IDX.AUTO;
        break;
      case MODE_MAN:
        idxMode = IDX.MANUAL;
        break;
    }
    const datas = [];
    for (const row of rng.getValues()) {
      if (row[idxMode] === false) continue;
      const data = {
        REPEAT: row[IDX.REPEAT],
        MONTH: row[IDX.MONTH],
        DAY: row[IDX.DAY],
        DAY_OF_WEEK: row[IDX.DAY_OF_WEEK],
        CUSTOM_WEEK: row[IDX.CUSTOM_WEEK],
        CUSTOM_DAY_OF_WEEK: row[IDX.CUSTOM_DAY_OF_WEEK],
        PREV_BIZ: row[IDX.PREV_BIZ],
        NEXT_BIZ: row[IDX.NEXT_BIZ],
        TAG: row[IDX.TAG],
        TITLE: row[IDX.TITLE],
      }
      datas.push(data);
    }
    return datas;
  }
  /**
   * 登録対象月かどうか判定します。
   * @param data 登録データJSON
   * @param date 登録開始日
   * @return true: 登録対象月 / false: 登録対象外月
   */
  const isTargetMonth = (data, date) => {
    const targetMonth = date.getMonth() + 1;
    const monthArray = String(data.MONTH).split(',');
    for (const month of monthArray) {
      if (Number(month) === targetMonth) {
        return true;
      }
    }
    Logger.log('登録対象月ではありません。[タスク: %s]', data.TITLE);
    return false;
  }
  /**
   * 毎週タスクを登録します。
   * @param data 登録データJSON
   * @param date 登録開始日
   */
  const registWeekly = (data, date) => {
    // 対象月取得
    const targetMonth = date.getMonth();
    // 対象曜日取得
    const targetWeek = {
      sun: data.DAY_OF_WEEK === '日曜',
      mon: data.DAY_OF_WEEK === '月曜',
      tue: data.DAY_OF_WEEK === '火曜',
      wed: data.DAY_OF_WEEK === '水曜',
      thu: data.DAY_OF_WEEK === '木曜',
      fri: data.DAY_OF_WEEK === '金曜',
      sat: data.DAY_OF_WEEK === '土曜',
    }
    // 初回日付取得
    let targetDate = DateUtils.getNextDayFromWeek(date, targetWeek);
    // 対象外の月になるまで繰り返し登録
    do {
      LocalUtils.createPage(makePageTodo(data, targetDate));
      targetDate = DateUtils.getNextDayFromWeek(targetDate, targetWeek, false);
    } while (targetDate.getMonth() === targetMonth);
  }
  /**
   * 毎月タスクを登録します。
   * @param data 登録データJSON
   * @param date 登録開始日
   */
  const registMonthly = (data, date) => {
    const targetDate = new Date(date.getFullYear(), date.getMonth(), data.DAY);
    LocalUtils.createPage(makePageTodo(data, targetDate));
  }
  /**
   * 毎年タスクを登録します。
   * @param data 登録データJSON
   * @param date 登録開始日
   */
  const registYearly = (data, date) => {
    if (!isTargetMonth(data, date)) {
        return;
    }
    let targetDate = new Date(date.getFullYear(), date.getMonth(), data.DAY);
    if (date.getMonth() !== targetDate.getMonth()) {
      // 存在しない日の場合、最終日を設定
      targetDate = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    }
    LocalUtils.createPage(makePageTodo(data, targetDate));
  }
  /**
   * カスタムタスクを登録します。
   * @param data 登録データJSON
   * @param date 登録開始日
   */
  const registCustom = (data, date) => {
    if (data.MONTH && !isTargetMonth(data, date)) {
      return;
    }
    const targetWeek = {
      sun: data.CUSTOM_DAY_OF_WEEK === '日曜' || data.CUSTOM_DAY_OF_WEEK === '週末' || data.CUSTOM_DAY_OF_WEEK === '休日',
      mon: data.CUSTOM_DAY_OF_WEEK === '月曜',
      tue: data.CUSTOM_DAY_OF_WEEK === '火曜',
      wed: data.CUSTOM_DAY_OF_WEEK === '水曜',
      thu: data.CUSTOM_DAY_OF_WEEK === '木曜',
      fri: data.CUSTOM_DAY_OF_WEEK === '金曜',
      sat: data.CUSTOM_DAY_OF_WEEK === '土曜' || data.CUSTOM_DAY_OF_WEEK === '週末' || data.CUSTOM_DAY_OF_WEEK === '休日',
      hol: data.CUSTOM_DAY_OF_WEEK === '休日',
    }
    let targetDate;
    let dates;
    switch (data.CUSTOM_WEEK) {
      case '第１':
        dates = DateUtils.getDateFromWeekNo(date, 1);
        break;
      case '第２':
        dates = DateUtils.getDateFromWeekNo(date, 2);
        break;
      case '第３':
        dates = DateUtils.getDateFromWeekNo(date, 3);
        break;
      case '第４':
        dates = DateUtils.getDateFromWeekNo(date, 4);
        break;
      case '第５':
        dates = DateUtils.getDateFromWeekNo(date, 5);
        break;
      case '最終':
        const lastDate = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        switch (data.CUSTOM_DAY_OF_WEEK) {
          case '日':
            targetDate = lastDate;
            break;
          default:
            targetDate = DateUtils.getPrevDayFromWeek(lastDate, targetWeek);
            break;
        }
        break;
      default:
        Logger.log('不正なカスタム週です。 ' + data);
        return;
    }
    if (dates) {
      targetDate = DateUtils.getNextDayFromWeek(dates[0], targetWeek);
      if (targetDate.getTime() > dates[1].getTime()) {
        // 週の範囲外の場合は処理終了
        return;
      }
    }
    LocalUtils.createPage(makePageTodo(data, targetDate));
  }

  /**
   * 登録対象日を取得します。
   * @param 営業日可否
   * @param 対象日
   * @return 登録対象日
   */
  const getRegistDate = ({PREV_BIZ, NEXT_BIZ}, date) => {
    if (PREV_BIZ) {
      return DateUtils.getBizDatePrev(date);
    }
    if (NEXT_BIZ) {
      return DateUtils.getBizDateNext(date);
    }
    return date;
  }
  /**
   * タスクページを生成します。
   * @param data 登録データJSON
   * @param date 対象日
   * @return ページ情報
   */
  const makePageTodo = (data, date) => {
    // プロパティ要素設定
    const limitDate = getRegistDate(data, date);
    const propItem = new Map();
    propItem.set(Constants.PROPERTY_TODO.TASK, new PropTitle(data.TITLE));
    propItem.set(Constants.PROPERTY_TODO.LIMIT, new PropDate(limitDate, false));
    propItem.set(Constants.PROPERTY_TODO.TAG, new PropSelect(data.TAG));
    return new Page(LocalUtils.getDatabaseId(limitDate.getFullYear(), Constants.DATABASE_ID.TODO), propItem);
  }
  return {
    create: (mode) => {
      // 登録データ取得
      const datas = getRegData(mode);
      // 対象日取得
      const now = new Date();
      switch (mode) {
        case MODE_AUTO:
          // 基準日：実行日翌月1日
          targetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
          break;
        case MODE_MAN:
          // 基準日：実行日
          targetDate = now;
          break;
      }

      for (const data of datas) {
        switch (data.REPEAT) {
          case '毎週':
            registWeekly(data, targetDate);
            break;
          case '毎月':
            registMonthly(data, targetDate);
            break;
          case '毎年':
            registYearly(data, targetDate);
            break;
          case 'カスタム':
            registCustom(data, targetDate);
            break;
        }
      }
    },
    error: (e) => {
      if (e instanceof DbNotFoundException) {
        LineUtil.postText(props.LINE_CHANNEL_TOKEN, props.LINE_USER_ID, e.message);
        return;
      }
      throw e;
    },
  };
})();

function CreateTodo() {
  LocalUtils.showLoading();
  MainProcAutoTodo.create(MODE_MAN);
  LocalUtils.closeLoading();
}

function AutoCreateTodo() {
  try {
    MainProcAutoTodo.create(MODE_AUTO)
  } catch (e) {
    MainProcAutoTodo.error(e);
  }
}

