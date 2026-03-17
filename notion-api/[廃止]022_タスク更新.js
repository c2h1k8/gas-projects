const MainProcTodo = (function () {
  const ROW_HEADER = 2;
  const ROW_DATA = 3;
  const COL_CHK = 2;
  const COL_ID = 3;
  const COL_TASK = 4;
  const IDX_COL_CHK = 0;
  const IDX_COL_ID = 1;
  const IDX_COL_TASK = 2;
  const IDX_COL_LIMIT = 3;
  const IDX_COL_TAG = 4;
  const RNG_SEARCH_CONDIITON_TASK = 'I7';
  const RNG_SEARCH_CONDIITON_TAG = 'I8';
  const RNG_SEARCH_CONDIITON_NOT_COMPLETE = 'I9';
  const RNG_SEARCH_CONDIITON_FROM = 'I10';
  const RNG_SEARCH_CONDIITON_TO = 'I11';
  
  /**
   * シートを取得します。
   * @return スプレッドシート
   */
  const getSheet = () => {
    return SpreadsheetApp.getActiveSpreadsheet().getSheetByName('タスク更新');
  }
  /**
   * データレンジオブジェクトを取得します。
   * @param sheet スプレッドシート
   * @return データレンジオブジェクト
   */
  const getDataRange = (sheet) => {
    const rowCnt = Utils.getEndRow(sheet, COL_TASK) - ROW_HEADER;
    const colCnt = Utils.getEndCol(sheet, ROW_HEADER) - COL_CHK + 1;
    if (rowCnt === 0) {
      return undefined;
    }
    return sheet.getRange(ROW_DATA, COL_CHK, rowCnt, colCnt);
  }
/**
   * 検索条件を指定して検索します。
   * @param sheet シート
   * @return 検索結果
   * https://developers.notion.com/reference/post-database-query-filter
   */
  const executeSelect = (sheet) => {
    const task = sheet.getRange(RNG_SEARCH_CONDIITON_TASK).getValue();
    const tag = sheet.getRange(RNG_SEARCH_CONDIITON_TAG).getValue();
    const notCompleted = sheet.getRange(RNG_SEARCH_CONDIITON_NOT_COMPLETE).getValue();
    const periodFrom = sheet.getRange(RNG_SEARCH_CONDIITON_FROM).getValue();
    const periodTo = sheet.getRange(RNG_SEARCH_CONDIITON_TO).getValue();
    const filterItems = [];
    if (task) {
      filterItems.push(new FilterItem(Constants.PROPERTY_TODO.TASK, 'title', 'equals', task));
    }
    if (tag) {
      filterItems.push(new FilterItem(Constants.PROPERTY_TODO.TAG, 'select', 'equals', tag));
    }
    if (notCompleted) {
      filterItems.push(new FilterItem(Constants.PROPERTY_TODO.COMPLETE, 'checkbox', 'equals', false));
    }
    if (periodFrom) {
      filterItems.push(new FilterItem(Constants.PROPERTY_TODO.LIMIT, 'date', 'on_or_after', periodFrom));
    }
    if (periodTo) {
      filterItems.push(new FilterItem(Constants.PROPERTY_TODO.LIMIT, 'date', 'on_or_before', periodTo));
    }
    const databaseIdMap = LocalUtils.getDatabaseIdMap(Constants.DATABASE_ID.TODO);
    let resultArray = []
    for (const [year, databaseId] of databaseIdMap) {
      if (periodFrom && periodFrom.getFullYear() > year) continue;
      if (periodTo && periodTo.getFullYear() < year) continue;
      filterCategory = []
      const resultQuery = LocalUtils.getPages(databaseId, new Filter(filterItems.concat(filterCategory)));
      // 検索結果格納
      resultArray = resultArray.concat(resultQuery);
    }
    return resultArray;
  }

  return {
    search: () => {
      const sheet = getSheet();
      const rng = getDataRange(sheet);
      if (rng) {
        // 既存データクリア
        rng.clear();
      }
      // 検索
      const resultArray = executeSelect(sheet);
      if (resultArray.length == 0) {
        Browser.msgBox('対象のデータがありません。');
        return false;
      }
      const outData = [];
      for (const result of resultArray) {
        const rowData = [];
        const properties = result.properties;
        // ID
        rowData.push(result.id);
        // タスク
        const task = properties[Constants.PROPERTY_TODO.TASK].title[0].plain_text;
        rowData.push(task);
        // 期日
        rowData.push(properties[Constants.PROPERTY_TODO.LIMIT].date.start);
        // タグ
        const tagItem = properties[Constants.PROPERTY_TODO.TAG].select;
        rowData.push(tagItem ? tagItem.name : '');
        // 完了
        const isComplete = properties[Constants.PROPERTY_TODO.COMPLETE].checkbox;
        rowData.push(isComplete);
        outData.push(rowData);
      }
      // ソート
      const sortMap = new Map();
      sortMap.set(2, true);    // 期日昇順
      LocalUtils.sort(outData, sortMap);
      // データ出力
      const rowCnt = outData.length;
      const colCnt = outData[0].length;
      sheet.getRange(ROW_DATA, COL_ID, rowCnt, colCnt).setValues(outData);
      for (let i = 0; i < rowCnt; i += 2) {
        sheet.getRange(ROW_DATA + i, COL_CHK, 1, colCnt + 1).setBackground('#FFFFEF');
      }
      return true;
    },
    update: () => {
      const sheet = getSheet();
      const rng = getDataRange(sheet);
      if (!rng) {
        Browser.msgBox('更新対象のデータが見つかりません。');
        return false;
      }
      const values = rng.getValues();
      for (const value of values) {
        const isUpd = value[IDX_COL_CHK];
        if (!isUpd) continue;
        const id = value[IDX_COL_ID];
        const task = value[IDX_COL_TASK];
        const limit = value[IDX_COL_LIMIT];
        if (!task || !limit) {
          Browser.msgBox('入力内容を見直してください。');
          return false;
        }
        const tag = value[IDX_COL_TAG];
        const propItem = new Map();
        propItem.set(Constants.PROPERTY_TODO.TASK, new PropTitle(task));
        propItem.set(Constants.PROPERTY_TODO.LIMIT, new PropDate(limit, false));
        propItem.set(Constants.PROPERTY_TODO.TAG, new PropSelect(tag));
        const page = new Page(LocalUtils.getDatabaseId(limit.getFullYear(), Constants.DATABASE_ID.TODO), propItem);
        if (id) {
          // 更新
          // 日付の年が変わっていないか確認
          const oldYear = Number(LocalUtils.getPageFromId(id).properties[Constants.PROPERTY_TODO.LIMIT].date.start.substr(0, 4));
          if (oldYear === limit.getFullYear()) {
            // 更新
            LocalUtils.updatePage(id, page, true);
          } else {
            // 登録
            LocalUtils.createPage(page);
            // 削除
            LocalUtils.deletePage(id);
          }
        } else {
          // 登録
          LocalUtils.createPage(page);
        }
      }
      return true;
    },
    delete: () => {
      const sheet = getSheet();
      const rng = getDataRange(sheet);
      if (!rng) {
        Browser.msgBox('削除対象のデータが見つかりません。');
        return false;
      }
      const values = rng.getValues();
      for (const value of values) {
        const isUpd = value[IDX_COL_CHK];
        if (!isUpd) continue;
        const id = value[IDX_COL_ID];
        LocalUtils.deletePage(id);
      }
      return true;
    },
  };
})();

function OnClickSearchTodo() {
  LocalUtils.showLoading();
  MainProcTodo.search();
  LocalUtils.closeLoading();
}

function OnClickUpdateTodo() {
  LocalUtils.showLoading();
  if (MainProcTodo.update()) {
    MainProcTodo.search();
  }
  LocalUtils.closeLoading();
}

function OnClickDeleteTodo() {
  LocalUtils.showLoading();
  if (MainProcTodo.delete()) {
    MainProcTodo.search();
  }
  LocalUtils.closeLoading();
}