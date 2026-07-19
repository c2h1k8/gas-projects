const MainProcUpdate = (function () {
  const ROW_HEADER = 2;
  const ROW_DATA = 3;
  const COL_CHK = 2;
  const COL_ID = 3;
  const COL_AMOUNT = 7;

  const RNG_SEARCH_CONDITION_TITLE = "N7";
  const RNG_SEARCH_CONDITION_CATEGORY = "N8";
  const RNG_SEARCH_CONDITION_UNFINISHED = "N9";
  const RNG_SEARCH_CONDITION_FROM = "N10";
  const RNG_SEARCH_CONDITION_TO = "N11";
  const RNG_SEARCH_CONDITION_METHOD_PAY = "N12";
  const RNG_SEARCH_CONDITION_PAYEE = "N13";

  const getSheet = () =>
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName("支出更新");

  /**
   * データ範囲を取得
   */
  const getDataRange = (sheet) => {
    const start = Date.now();
    const rowCnt = SpreadUtils.getEndRow(sheet, COL_AMOUNT) - ROW_HEADER;
    const colCnt = SpreadUtils.getEndCol(sheet, ROW_HEADER) - COL_CHK + 1;
    Logger.log(
      `[getDataRange] rowCnt: ${rowCnt}, colCnt: ${colCnt}, time: ${Date.now() - start}ms`,
    );
    if (rowCnt === 0) return undefined;
    return sheet.getRange(ROW_DATA, COL_CHK, rowCnt, colCnt);
  };

  const fmtYmd = (d) =>
    !d
      ? undefined
      : Object.prototype.toString.call(d) === "[object Date]"
        ? Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd")
        : String(d).slice(0, 10);

  /**
   * 検索条件で money API から支出を取得します。
   * 名前/カテゴリ/支払先/支払方法も money API に渡す（DSL: /api/spending/search）。
   * @param {Sheet} sheet - 検索条件を持つシート
   * @return {Array<object>} /api/spending items
   */
  const executeSelect = (sheet) => {
    const start = Date.now();
    Logger.log("[executeSelect] start");
    const title = sheet.getRange(RNG_SEARCH_CONDITION_TITLE).getValue();
    const category = sheet.getRange(RNG_SEARCH_CONDITION_CATEGORY).getValue();
    const unfinished = sheet
      .getRange(RNG_SEARCH_CONDITION_UNFINISHED)
      .getValue();
    const periodFrom = sheet.getRange(RNG_SEARCH_CONDITION_FROM).getValue();
    const periodTo = sheet.getRange(RNG_SEARCH_CONDITION_TO).getValue();
    const methodPay = sheet
      .getRange(RNG_SEARCH_CONDITION_METHOD_PAY)
      .getValue();
    const payee = sheet.getRange(RNG_SEARCH_CONDITION_PAYEE).getValue();

    const items = MoneyApi.searchSpending({
      from: fmtYmd(periodFrom),
      to: fmtYmd(periodTo),
      title,
      category,
      methodPay,
      payee,
      unfinished: !!unfinished, // 未完了＝未確認(CONFIRMED=0)
    });

    Logger.log(`[executeSelect] end: ${Date.now() - start}ms`);
    return items;
  };

  return {
    search: () => {
      const start = Date.now();

      LoadingUI.hint("検索条件を確認しています…");
      Logger.log("[search] start");
      const sheet = getSheet();

      LoadingUI.hint("既存の表示をクリアしています…");
      // 既存データクリア
      const rng = getDataRange(sheet);
      if (rng) rng.clear();

      LoadingUI.hint("データを取得しています…");
      const resultArray = executeSelect(sheet);
      if (resultArray.length === 0) {
        Logger.log("[search] no data found");
        Browser.msgBox("対象のデータがありません。");
        return false;
      }

      LoadingUI.hint("検索結果を整形しています…");
      const outData = resultArray.map((it) => [
        it.uuid,
        it.name,
        it.category || "",
        it.date,
        it.amount,
        it.payee || "",
        it.method_pay || "",
        it.url || "",
        it.note || "",
        it.expense_ratio || 0,
      ]);

      LoadingUI.hint("検索結果を並び替えています…");
      // ソート
      const sortMap = new Map([
        [3, false], // 日付降順
        [4, true], // 値段昇順
      ]);
      CoreUtils.sort(outData, sortMap);

      LoadingUI.hint("検索結果をシートに反映しています…");
      // データ出力
      const rowCnt = outData.length;
      const colCnt = outData[0].length;
      const outRng = sheet.getRange(ROW_DATA, COL_ID, rowCnt, colCnt);
      outRng.setValues(outData);
      outRng.setVerticalAlignment("top");

      LoadingUI.hint("表示を整えています…");
      for (let i = 0; i < rowCnt; i += 2) {
        sheet
          .getRange(ROW_DATA + i, COL_CHK, 1, colCnt + 1)
          .setBackground("#FFFFEF");
      }
      Logger.log(`[search] end: ${Date.now() - start}ms`);
      return true;
    },
    update: () => {
      const start = Date.now();
      Logger.log("[update] start");

      LoadingUI.hint("更新対象を確認しています…");
      const sheet = getSheet();
      const rng = getDataRange(sheet);
      if (!rng) {
        Logger.log("[update] no target data");
        Browser.msgBox("更新対象のデータが見つかりません。");
        return false;
      }
      const values = rng.getValues();
      Logger.log(`[update] total rows to process: ${values.length}`);

      let rowIndex = 0;
      for (const row of values) {
        rowIndex++;
        let [
          isUpd,
          id,
          title,
          category,
          date,
          amount,
          payee,
          methodPay,
          url,
          note,
          expenseRatio,
        ] = row;
        if (!isUpd) continue;

        LoadingUI.hint(` ${rowIndex} 行目を処理しています…`);

        const rowStart = Date.now();
        Logger.log(
          `[update] row ${rowIndex}: processing id=${id || "new"}, title=${title}, date=${date}`,
        );

        LoadingUI.hint(` ${rowIndex} 行目の入力内容を確認しています…`);
        if (!title || !date) {
          Logger.log(`[update] invalid row data: ${JSON.stringify(row)}`);
          Browser.msgBox("入力内容を見直してください。");
          return false;
        }

        const payload = {
          name: title,
          date,
          category,
          amount,
          payee,
          methodPay,
          url,
          note,
          expenseRatio,
        };
        if (id) {
          // 既存レコードの更新（カテゴリ等は名前でOK＝サーバ解決）
          LoadingUI.hint(` ${rowIndex} 行目を更新しています…`);
          MoneyApi.updateSpending(id, payload);
        } else {
          // 新規は money API へ「未確認」で登録
          LoadingUI.hint(` ${rowIndex} 行目を新規登録しています…`);
          MoneyApi.registerSpending(payload);
        }
        Logger.log(`[update] row updated in ${Date.now() - rowStart}ms`);
      }

      LoadingUI.hint("更新後の処理を完了しています…");
      Logger.log(`[update] end: ${Date.now() - start}ms`);
      return true;
    },
    delete: () => {
      const start = Date.now();
      Logger.log("[delete] start");
      const sheet = getSheet();
      const rng = getDataRange(sheet);
      if (!rng) {
        Logger.log("[delete] no target data");
        Browser.msgBox("削除対象のデータが見つかりません。");
        return false;
      }
      const values = rng.getValues();
      for (const row of values) {
        const [isUpd, id] = row;
        if (!isUpd) continue;
        if (id) MoneyApi.deleteSpending(id);
      }
      Logger.log(`[delete] end: ${Date.now() - start}ms`);
      return true;
    },
  };
})();

const handleSpendingError_ = (e) => {
  if (e instanceof DbNotFoundException) {
    Browser.msgBox(e.message);
    return;
  }
  throw e;
};

function OnClickSearchSpending() {
  return withLoading(
    function () {
      try {
        MainProcUpdate.search();
      } catch (e) {
        handleSpendingError_(e);
      }
    },
    {
      startHint: "検索中…",
      successHint: "検索完了！",
    },
  );
}

function OnClickUpdateSpending() {
  return withLoading(
    function () {
      try {
        if (MainProcUpdate.update()) MainProcUpdate.search();
      } catch (e) {
        handleSpendingError_(e);
      }
    },
    {
      startHint: "更新中…",
      successHint: "更新完了！",
    },
  );
}

function OnClickDeleteSpending() {
  return withLoading(
    function () {
      try {
        if (MainProcUpdate.delete()) MainProcUpdate.search();
      } catch (e) {
        handleSpendingError_(e);
      }
    },
    {
      startHint: "削除中…",
      successHint: "削除完了！",
    },
  );
}
