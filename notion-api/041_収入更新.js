const MainProcIncome = (() => {
  // ==== Constants ====
  const SHEET_NAME = '収入更新';

  const ROW_HEADER = 2;
  const ROW_DATA = 3;

  const COL_CHK = 2;
  const COL_ID = 3;
  const COL_TITLE = 4;

  const IDX = {
    CHK: 0,
    ID: 1,
    TITLE: 2,
    DATE: 3,
    AMOUNT: 4,
  };

  const RNG = {
    TITLE: 'H7',
    UNFINISHED: 'H8',
    FROM: 'H9',
    TO: 'H10',
  };
 
  // ===== Sheet helpers =====
  const getSheet = () => SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);

  /**
   * データ範囲（チェック列〜最終列）を返す。データが無ければ null
   */
  const getDataRange = (sheet) => {
    const endRow = Utils.getEndRow(sheet, COL_TITLE);
    const rowCnt = endRow - ROW_HEADER;
    if (rowCnt <= 0) return null;

    const endCol = Utils.getEndCol(sheet, ROW_HEADER);
    const colCnt = endCol - COL_CHK + 1;

    return sheet.getRange(ROW_DATA, COL_CHK, rowCnt, colCnt);
  };

  const clearDataRange = (sheet) => {
    const rng = getDataRange(sheet);
    if (rng) rng.clearContent();
  };

  // ===== UI helpers =====
  const msg = (text) => Browser.msgBox(text);

  // ===== Domain helpers =====
  const stripIconSuffix = (title) => {
    if (!title) return title;
    const idx = title.indexOf('(');
    if (idx > -1) {
      // "(...)" の前まで
      const m = title.match(/(^.*?)(?=\()/);
      return m ? m[0] : title;
    }
    return title;
  };

  /**
   * "タイトル(😀)" を { title, icon } に分解
   */
  const splitTitleAndIcon = (rawTitle) => {
    if (!rawTitle) return { title: rawTitle, icon: null };

    const startIdx = rawTitle.indexOf('(');
    const endIdx = rawTitle.indexOf(')');

    if (startIdx > 0 && endIdx > startIdx) {
      const icon = rawTitle.substring(startIdx + 1, endIdx);
      const title = rawTitle.substring(0, startIdx);
      return { title, icon };
    }
    return { title: rawTitle, icon: null };
  };

  /**
   * Notionページのタイトルに icon を付与した表示用文字列を作る
   */
  const formatTitleWithIcon = (titlePlain, iconObj) => {
    if (!titlePlain) return '';
    if (iconObj && iconObj.emoji) return `${titlePlain}(${iconObj.emoji})`;
    return titlePlain;
  };

  const buildFilterFromSheet = (sheet) => {
    let title = sheet.getRange(RNG.TITLE).getValue();
    const unfinished = sheet.getRange(RNG.UNFINISHED).getValue();
    const periodFrom = sheet.getRange(RNG.FROM).getValue();
    const periodTo = sheet.getRange(RNG.TO).getValue();

    const filterItems = [];

    if (title) {
      title = stripIconSuffix(title);
      filterItems.push(new NotionFilterItem(Constants.PROPERTY_INCOME.TITLE, 'title', 'equals', title));
    }
    if (unfinished) {
      filterItems.push(new NotionFilterItem(Constants.PROPERTY_INCOME.CHECKED, 'checkbox', 'equals', false));
    }
    if (periodFrom) {
      filterItems.push(new NotionFilterItem(Constants.PROPERTY_INCOME.DATE, 'date', 'on_or_after', periodFrom));
    }
    if (periodTo) {
      filterItems.push(new NotionFilterItem(Constants.PROPERTY_INCOME.DATE, 'date', 'on_or_before', periodTo));
    }
    return new NotionFilter(filterItems);
  };

  const fetchIncomePages = (sheet) => {
    const filter = buildFilterFromSheet(sheet);
    return LocalUtils.getPages(Props.getValue(PKeys.DATA_SOURCE_ID_INCOME), filter);
  };

  // ===== Output helpers =====
  const mapPagesToRows = (pages) => {
    const out = [];

    for (const page of pages) {
      const props = page.properties;

      const titlePlain = props[Constants.PROPERTY_INCOME.TITLE].title[0].plain_text;
      const title = formatTitleWithIcon(titlePlain, page.icon);
      
      const date = props[Constants.PROPERTY_INCOME.DATE].date.start;
      const amount = props[Constants.PROPERTY_INCOME.AMOUNT].number;
      out.push([ page.id, title, date, amount ]);
    }

    return out;
  };

  const sortRows = (rows) => {
    // outData: [id, title, date, amount]
    const sortMap = new Map();
    sortMap.set(2, false); // 日付降順
    sortMap.set(3, true); // 金額昇順
    LocalUtils.sort(rows, sortMap);
  };

  const writeRows = (sheet, rows) => {
    const rowCnt = rows.length;
    const colCnt = rows[0].length;

    sheet.getRange(ROW_DATA, COL_ID, rowCnt, colCnt).setValues(rows);
  };
  
  const search = () => {
    const sheet = getSheet();
    
    clearDataRange(sheet);
    
    const pages = fetchIncomePages(sheet);
    if (pages.length === 0) {
      msg('対象のデータがありません。');
      return false;
    }

    const rows = mapPagesToRows(pages);
    sortRows(rows);
    writeRows(sheet, rows);

    return true;
  };

  const validateUpsertRow = (row) => {
    const title = row[IDX.TITLE];
    if (!title) return { ok: false, reason: '入力内容を見直してください。' };
    return { ok: true }
  }

  const upsertOne = (row) => {
    const id = row[IDX.ID];
    const rawTitle = row[IDX.TITLE];
    const amount = row[IDX.AMOUNT];
    
    const date = row[IDX.DATE] ? row[IDX.DATE] : new Date();
    
    const { title, icon } = splitTitleAndIcon(rawTitle);
    const payload = LocalUtils.getCreateIncome({
      icon,
      title,
      date,
      amount,
    });
    
    if (id) {
      LocalUtils.updatePage(id, payload);
    } else {
      LocalUtils.createPage(payload);
    }
  }

  const upsert = () => {
    const sheet = getSheet();
    const rng = getDataRange(sheet);

    if (!rng) {
      msg('更新対象のデータが見つかりません。');
      return false;
    }

    const values = rng.getValues();
    const targets = values.filter((row) => !!row[IDX.CHK]);

    for (const row of targets) {
      const v = validateUpsertRow(row);
      if (!v.ok) {
        msg(v.reason);
        return false;
      }
      upsertOne(row);
    }

    return true;
  };

  const deleteChecked = () => {
    const sheet = getSheet();
    const rng = getDataRange(sheet);

    if (!rng) {
      msg('削除対象のデータが見つかりません。');
      return false;
    }

    const values = rng.getValues();
    const targets = values.filter((row) => !!row[IDX.CHK]);
    
    for (const row of targets) {
      const id = row[IDX.ID];
      if (id) LocalUtils.deletePage(id);
    }

    return true;
  };

  return { search, upsert, delete: deleteChecked };
})();

// ===== click handlers =====
const handleError_ = (e) => {
  if (e instanceof DbNotFoundException) {
    Browser.msgBox(e.message);
    return;
  }
  throw e;
};

function OnClickSearchIncome() {
  return withLoading(function () {
    try {
      MainProcIncome.search();
    } catch (e) { handleError_(e); }
  }, { startHint: '検索中…', successHint: '検索完了！' });
}

function OnClickUpdateIncome() {
  return withLoading(function () {
    try {
      if (MainProcIncome.upsert()) MainProcIncome.search();
    } catch (e) { handleError_(e); }
  }, { startHint: '更新中…', successHint: '更新完了！' });
}

function OnClickDeleteIncome() {
  return withLoading(function () {
    try {
      if (MainProcIncome.delete()) MainProcIncome.search();
    } catch (e) { handleError_(e); }
  }, { startHint: '削除中…', successHint: '削除完了！' });
}