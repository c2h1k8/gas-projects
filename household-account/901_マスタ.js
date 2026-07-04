const MainProcMaster = (() => {
  /**
   * データをワークシートに出力し、名前定義を設定します。
   * @param sheet ワークシート
   * @param colNo 列番号
   * @param lists 出力情報リスト
   */
  const outSheet = (sheet, colNo, lists) => {
    const rowNoEnd = SpreadUtils.getEndRow(sheet, colNo);
    if (Constants.SHEET_MASTER.ROW.HEADER !== rowNoEnd) {
      sheet.getRange(Constants.SHEET_MASTER.ROW.DATA, colNo, rowNoEnd - Constants.SHEET_MASTER.ROW.HEADER, 1).clear();
    }

    const colValues = (lists ?? []).map(v => [v]);
    if (colValues.length === 0)  return;

    const rng = sheet.getRange(Constants.SHEET_MASTER.ROW.DATA, colNo, colValues.length, 1);
    rng.setValues(colValues);
    // 名前付き範囲設定
    const name = sheet.getRange(Constants.SHEET_MASTER.ROW.HEADER, colNo).getValue();
    SpreadsheetApp.getActiveSpreadsheet().setNamedRange(name, rng);
  }

  const getExceptWordTitleList = () => SpreadsheetApp.getActiveSpreadsheet()
    .getRangeByName(Constants.SHEET_MASTER.RNG_NAME.EXCEPT_WORD)
    .getValues()
    .map(item => item[0]);
    
  const getTargetColList = () => {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(Constants.SHEET_MASTER.NAME);
    const colNoEnd = SpreadUtils.getEndCol(sheet, Constants.SHEET_MASTER.ROW.CHK);
    const valuesChk = sheet.getRange(Constants.SHEET_MASTER.ROW.CHK, Constants.SHEET_MASTER.COL.CHK_TARGET, 1, colNoEnd).getValues()[0];
    return valuesChk.map((val, i) => val && i > 0 ? i + 1 : null).filter(x => x);
  }

  /**
   * 各データベースから情報を取得します（money API のマスタから）。
   * @return データJSON
   */
  const getData = () => {
    const colList = getTargetColList();
    if (!colList.length) return undefined;
    const m = MoneyApi.getMasters();
    // 支出項目名は除外ワードを差し引く
    const exceptSet = new Set(getExceptWordTitleList());
    const spendingNames = (m.spendingNames ?? []).filter(n => !exceptSet.has(n));
    const C = Constants.SHEET_MASTER.COL;
    const byCol = {
      [C.TITLE_SPENDING]: spendingNames,
      [C.TITLE_INCOME]: m.incomeNames ?? [],
      [C.CATEGORY]: m.categories ?? [],
      [C.SHOP]: m.shops ?? [],
      [C.METHOD_PAY]: m.methodPay ?? [],
    };
    const resultMap = new Map();
    for (const col of colList) {
      if (byCol[col]) resultMap.set(col, byCol[col]);
    }
    return resultMap;
  }

  /**
   * 手動入力列（LINE用選択肢）の名前付き範囲を、入力済みデータ範囲に合わせて更新します。
   * 列のデータは上書きせず、見出し名で名前付き範囲だけ張り直します。
   */
  // チェック行(1行目)がONの列か
  const isCheckedCol = (sheet, colNo) =>
    !!sheet.getRange(Constants.SHEET_MASTER.ROW.CHK, colNo).getValue();

  const registManualRange = (sheet, colNo, name) => {
    const rowEnd = SpreadUtils.getEndRow(sheet, colNo);
    if (rowEnd < Constants.SHEET_MASTER.ROW.DATA) return; // データなし
    const rng = sheet.getRange(
      Constants.SHEET_MASTER.ROW.DATA, colNo,
      rowEnd - Constants.SHEET_MASTER.ROW.HEADER, 1
    );
    SpreadsheetApp.getActiveSpreadsheet().setNamedRange(name, rng);
  }

  return {
    update: () => {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(Constants.SHEET_MASTER.NAME);
      // 自動取得列（Notion等）を出力
      const resultMap = getData()
      if (resultMap) {
        for (const key of resultMap.keys()) {
          outSheet(sheet, key, resultMap.get(key));
        }
      }
      // LINE用選択肢（手動入力 H/I）はチェックON時のみ名前付き範囲を反映
      if (isCheckedCol(sheet, Constants.SHEET_MASTER.COL.LINE_CATEGORY)) {
        registManualRange(sheet, Constants.SHEET_MASTER.COL.LINE_CATEGORY, Constants.SHEET_MASTER.RNG_NAME.LINE_CATEGORY);
      }
      if (isCheckedCol(sheet, Constants.SHEET_MASTER.COL.LINE_METHOD_PAY)) {
        registManualRange(sheet, Constants.SHEET_MASTER.COL.LINE_METHOD_PAY, Constants.SHEET_MASTER.RNG_NAME.LINE_METHOD_PAY);
      }
      // 除外ワード(J)もチェックON時に名前付き範囲を反映
      if (isCheckedCol(sheet, Constants.SHEET_MASTER.COL.EXCEPT_WORD)) {
        registManualRange(sheet, Constants.SHEET_MASTER.COL.EXCEPT_WORD, Constants.SHEET_MASTER.RNG_NAME.EXCEPT_WORD);
      }
    },
  };
})();

function OnClickUpdateDataValidationList() {
  return withLoading(function () {
    MainProcMaster.update()
  }, {
    startHint: '更新中…',
    successHint: '更新完了！'
  });
}