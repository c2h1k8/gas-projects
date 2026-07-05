const MainProcIncome = (() => {
  // ==== Constants ====
  const SHEET_NAME = "収入更新";

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
    TITLE: "H7",
    UNFINISHED: "H8",
    FROM: "H9",
    TO: "H10",
  };

  // ===== Sheet helpers =====
  const getSheet = () =>
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);

  /**
   * データ範囲（チェック列〜最終列）を返す。データが無ければ null
   */
  const getDataRange = (sheet) => {
    const endRow = SpreadUtils.getEndRow(sheet, COL_TITLE);
    const rowCnt = endRow - ROW_HEADER;
    if (rowCnt <= 0) return null;

    const endCol = SpreadUtils.getEndCol(sheet, ROW_HEADER);
    const colCnt = endCol - COL_CHK + 1;

    return sheet.getRange(ROW_DATA, COL_CHK, rowCnt, colCnt);
  };

  const clearDataRange = (sheet) => {
    const rng = getDataRange(sheet);
    if (rng) rng.clearContent();
  };

  // ===== UI helpers =====
  const msg = (text) => Browser.msgBox(text);

  const fmtYmd = (d) => {
    if (!d) return undefined;
    if (Object.prototype.toString.call(d) === "[object Date]")
      return Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd");
    return String(d).slice(0, 10);
  };

  // シートの検索条件を money API のクエリ（+タイトル名フィルタ）に変換
  const buildQueryFromSheet = (sheet) => {
    const title = sheet.getRange(RNG.TITLE).getValue();
    const unfinished = sheet.getRange(RNG.UNFINISHED).getValue();
    return {
      title: title || "",
      confirmed: unfinished ? 0 : undefined, // 未完了＝未確認(CONFIRMED=0)
      from: fmtYmd(sheet.getRange(RNG.FROM).getValue()),
      to: fmtYmd(sheet.getRange(RNG.TO).getValue()),
    };
  };

  // ===== Output helpers =====  items: money API の /api/income items
  const mapItemsToRows = (items) =>
    items.map((it) => [it.uuid, it.name, it.date, it.amount]);

  const sortRows = (rows) => {
    // outData: [id, title, date, amount]
    const sortMap = new Map();
    sortMap.set(2, false); // 日付降順
    sortMap.set(3, true); // 金額昇順
    CoreUtils.sort(rows, sortMap);
  };

  const writeRows = (sheet, rows) => {
    const rowCnt = rows.length;
    const colCnt = rows[0].length;

    sheet.getRange(ROW_DATA, COL_ID, rowCnt, colCnt).setValues(rows);
  };

  const search = () => {
    const sheet = getSheet();

    clearDataRange(sheet);

    const q = buildQueryFromSheet(sheet);
    const items = MoneyApi.searchIncome({
      from: q.from,
      to: q.to,
      title: q.title,
      unfinished: q.confirmed === 0,
    });
    if (items.length === 0) {
      msg("対象のデータがありません。");
      return false;
    }

    const rows = mapItemsToRows(items);
    sortRows(rows);
    writeRows(sheet, rows);

    return true;
  };

  const validateUpsertRow = (row) => {
    const title = row[IDX.TITLE];
    if (!title) return { ok: false, reason: "入力内容を見直してください。" };
    return { ok: true };
  };

  const upsertOne = (row) => {
    const id = row[IDX.ID];
    const rawTitle = row[IDX.TITLE];
    const amount = row[IDX.AMOUNT];

    const date = row[IDX.DATE] ? row[IDX.DATE] : new Date();

    const title = rawTitle;

    if (id) {
      MoneyApi.updateIncome(id, { name: title, date, amount });
    } else {
      // 新規は money API へ「未確認」で登録
      MoneyApi.registerIncome({ name: title, date, amount });
    }
  };

  const upsert = () => {
    const sheet = getSheet();
    const rng = getDataRange(sheet);

    if (!rng) {
      msg("更新対象のデータが見つかりません。");
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
      msg("削除対象のデータが見つかりません。");
      return false;
    }

    const values = rng.getValues();
    const targets = values.filter((row) => !!row[IDX.CHK]);

    for (const row of targets) {
      const id = row[IDX.ID];
      if (id) MoneyApi.deleteIncome(id);
    }

    return true;
  };

  return { search, upsert, delete: deleteChecked };
})();

// ===== click handlers =====
const handleIncomeError_ = (e) => {
  if (e instanceof DbNotFoundException) {
    Browser.msgBox(e.message);
    return;
  }
  throw e;
};

function OnClickSearchIncome() {
  return withLoading(
    function () {
      try {
        MainProcIncome.search();
      } catch (e) {
        handleIncomeError_(e);
      }
    },
    { startHint: "検索中…", successHint: "検索完了！" },
  );
}

function OnClickUpdateIncome() {
  return withLoading(
    function () {
      try {
        if (MainProcIncome.upsert()) MainProcIncome.search();
      } catch (e) {
        handleIncomeError_(e);
      }
    },
    { startHint: "更新中…", successHint: "更新完了！" },
  );
}

function OnClickDeleteIncome() {
  return withLoading(
    function () {
      try {
        if (MainProcIncome.delete()) MainProcIncome.search();
      } catch (e) {
        handleIncomeError_(e);
      }
    },
    { startHint: "削除中…", successHint: "削除完了！" },
  );
}
