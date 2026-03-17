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
   * 支出データベースから情報を取得します。
   * @return 支出情報配列
   */
  const getSpendingData = () => {
    const exceptWordTitleSet = new Set(getExceptWordTitleList());
    const resultSet = new Set();
    const resultArray =  NotionApi.getPages(Props.getValue(PKeys.DATA_SOURCE_ID_SPENDING));
    for (const result of resultArray) {
      const title = result.properties[Constants.PROPERTY_SPENDING.TITLE].title[0].plain_text;
      if (!exceptWordTitleSet.has(title)) {
        const icon = result['icon'];
        const content = icon ? `${title}(${icon.emoji})` : title;
        resultSet.add(content);
      }
    }
    return Array.from(resultSet).sort();
  }

  /**
   * 収入データベースから情報を取得します。
   * @return 収入情報配列
   */
  const getIncomeData = () => {
    const resultSet = new Set();
    const resultArray =  NotionApi.getPages(Props.getValue(PKeys.DATA_SOURCE_ID_INCOME));
    for (const result of resultArray) {
      const title = result.properties[Constants.PROPERTY_INCOME.TITLE].title[0].plain_text;
      const icon = result['icon'];
      const content = icon ? `${title}(${icon.emoji})` : title;
      resultSet.add(content);
    }
    return Array.from(resultSet).sort();
  }

  /**
   * 指定プロパティのselectオプション一覧を取得します。
   * @param {string} propertyKey プロパティキー
   * @return {string[]} ソート済み配列
   */
  const getSelectOptions = (propertyKey) => {
    const resultList = [];

    const columnMap = NotionApi.getDbColumns(
      Props.getValue(PKeys.DATA_SOURCE_ID_SPENDING),
      [propertyKey]
    );

    const property = columnMap.get(propertyKey);

    if (!property || !property.select || !property.select.options) {
      return [];
    }

    for (const option of property.select.options) {
      resultList.push(option.name);
    }

    return resultList.sort();
  };
  
  /**
   * 年間在庫データベースから商品情報を取得します。
   * @return 商品情報配列
   */
  const getProductData = () => {
    const resultSet = new Set();
    const resultArray =  NotionApi.getPages(Props.getValue(PKeys.DATA_SOURCE_ID_ANNUAL_STOCK));
    for (const result of resultArray) {
      const title = result.properties[Constants.PROPERTY_ANNUAL_STOCK.TITLE].title[0].plain_text;
      resultSet.add(title);
    }
    return Array.from(resultSet).sort();
  }

  /**
   * 各データベースから情報を取得します。
   * @return データJSON
   */
  const getData = () => {
    const colList = getTargetColList();
    if (!colList.length) return undefined;
    const resultMap = new Map();
    for (const col of colList) {
      switch (col) {
        case Constants.SHEET_MASTER.COL.TITLE_SPENDING:
          resultMap.set(col, getSpendingData());
          break;
        case Constants.SHEET_MASTER.COL.TITLE_INCOME:
          resultMap.set(col, getIncomeData());
          break;
        case Constants.SHEET_MASTER.COL.CATEGORY:
          resultMap.set(col, getSelectOptions(Constants.PROPERTY_SPENDING.CATEGORY));
          break;
        case Constants.SHEET_MASTER.COL.SHOP:
          resultMap.set(col, getSelectOptions(Constants.PROPERTY_SPENDING.SHOP));
          break;
        case Constants.SHEET_MASTER.COL.METHOD_PAY:
          resultMap.set(col, getSelectOptions(Constants.PROPERTY_SPENDING.METHOD_PAY));
          break;
        case Constants.SHEET_MASTER.COL.PRODUCT:
          resultMap.set(col, getProductData());
          break;
      }
    }
    return resultMap;
  }

  return {
    update: () => {
      // データ取得
      const resultMap = getData()
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(Constants.SHEET_MASTER.NAME);
      for (const key of resultMap.keys()) {
        outSheet(sheet, key, resultMap.get(key));
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