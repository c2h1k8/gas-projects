const MainProcUpdate = (function () {
  const ROW_HEADER = 2;
  const ROW_DATA = 3;
  const COL_CHK = 2;
  const COL_ID = 3;
  const COL_AMOUNT = 7;

  const RNG_SEARCH_CONDIITON_TITLE = 'N7';
  const RNG_SEARCH_CONDIITON_CATEGORY = 'N8';
  const RNG_SEARCH_CONDIITON_UNFINISHED = 'N9';
  const RNG_SEARCH_CONDIITON_FROM = 'N10';
  const RNG_SEARCH_CONDIITON_TO = 'N11';
  const RNG_SEARCH_CONDIITON_METHOD_PAY = 'N12';
  const RNG_SEARCH_CONDIITON_SHOP = 'N13';
 
  const getSheet = () => SpreadsheetApp.getActiveSpreadsheet().getSheetByName('支出更新');

  /**
   * データ範囲を取得
   */
  const getDataRange = (sheet) => {
    const start = Date.now();
    const rowCnt = Utils.getEndRow(sheet, COL_AMOUNT) - ROW_HEADER;
    const colCnt = Utils.getEndCol(sheet, ROW_HEADER) - COL_CHK + 1;
    Logger.log(`[getDataRange] rowCnt: ${rowCnt}, colCnt: ${colCnt}, time: ${Date.now() - start}ms`);
    if (rowCnt === 0) return undefined;
    return sheet.getRange(ROW_DATA, COL_CHK, rowCnt, colCnt);
  }

  /**
   * 検索条件を指定して検索します。
   * @param {Sheet} sheet - 検索条件を持つシート
   * @return {Array} Notionデータ
   * https://developers.notion.com/reference/post-database-query-filter
   */
  const executeSelect = (sheet) => {
    const start = Date.now();
    Logger.log('[executeSelect] start');
    let title = sheet.getRange(RNG_SEARCH_CONDIITON_TITLE).getValue();
    const category = sheet.getRange(RNG_SEARCH_CONDIITON_CATEGORY).getValue();
    const unfinished = sheet.getRange(RNG_SEARCH_CONDIITON_UNFINISHED).getValue();
    const periodFrom = sheet.getRange(RNG_SEARCH_CONDIITON_FROM).getValue();
    const periodTo = sheet.getRange(RNG_SEARCH_CONDIITON_TO).getValue();
    const methodPay = sheet.getRange(RNG_SEARCH_CONDIITON_METHOD_PAY).getValue();
    const shop = sheet.getRange(RNG_SEARCH_CONDIITON_SHOP).getValue();

    const filterItems = [];

    if (title) {
      if (title.includes('(')) {
        title = title.match(/(^.*)(?=\()/)[0];
      }
      filterItems.push(new FilterItem(Constants.PROPERTY_SPENDING.TITLE, 'title', 'equals', title));
    }
    if (category) {
      filterItems.push(new FilterItem(Constants.PROPERTY_SPENDING.CATEGORY, 'select', 'equals', category));
    }
    if (unfinished) {
      filterItems.push(new FilterItem(Constants.PROPERTY_SPENDING.CHECKED, 'checkbox', 'equals', false));
    }
    if (periodFrom) {
      filterItems.push(new FilterItem(Constants.PROPERTY_SPENDING.DATE, 'date', 'on_or_after', periodFrom));
    }
    if (periodTo) {
      filterItems.push(new FilterItem(Constants.PROPERTY_SPENDING.DATE, 'date', 'on_or_before', periodTo));
    }
    if (methodPay) {
      filterItems.push(new FilterItem(Constants.PROPERTY_SPENDING.METHOD_PAY, 'select', 'equals', methodPay));
    }
    if (shop) {
      filterItems.push(new FilterItem(Constants.PROPERTY_SPENDING.SHOP, 'select', 'equals', shop));
    }

    const resultArray = LocalUtils.getPages(Props.getValue(PKeys.DATA_SOURCE_ID_SPENDING), new Filter(filterItems));
    
    Logger.log(`[executeSelect] end: ${Date.now() - start}ms`);
    return resultArray;
  }

  return {
    search: () => {
      const start = Date.now();

      LoadingUI.hint('検索条件を確認しています…');
      Logger.log('[search] start');
      const sheet = getSheet();

      LoadingUI.hint('既存の表示をクリアしています…');
      // 既存データクリア
      const rng = getDataRange(sheet);
      if (rng) rng.clear();

      LoadingUI.hint('データを取得しています…');
      const resultArray = executeSelect(sheet);
      if (resultArray.length === 0) {
        Logger.log('[search] no data found');
        Browser.msgBox('対象のデータがありません。');
        return false;
      }

      LoadingUI.hint('検索結果を整形しています…');
      const outData = resultArray.map(result => {
        const props = result.properties;
        const icon = result['icon'];
        let titleText = props[Constants.PROPERTY_SPENDING.TITLE].title[0].plain_text;
        if (icon) titleText += `(${icon.emoji})`;

        return [
          result.id,
          titleText,
          props[Constants.PROPERTY_SPENDING.CATEGORY].select?.name || '',
          props[Constants.PROPERTY_SPENDING.DATE].date.start,
          props[Constants.PROPERTY_SPENDING.AMOUNT].number,
          props[Constants.PROPERTY_SPENDING.SHOP].select?.name || '',
          props[Constants.PROPERTY_SPENDING.METHOD_PAY].select?.name || '',
          props[Constants.PROPERTY_SPENDING.URL].url,
          props[Constants.PROPERTY_SPENDING.NOTE].rich_text[0]?.plain_text || '',
          props[Constants.PROPERTY_SPENDING.EXPENSE_RATIO].number,
        ];
      });

      LoadingUI.hint('検索結果を並び替えています…');
      // ソート
      const sortMap = new Map([
        [ 3, false ], // 日付降順
        [ 4, true ],  // 値段昇順
      ]);
      LocalUtils.sort(outData, sortMap);

      LoadingUI.hint('検索結果をシートに反映しています…');
      // データ出力
      const rowCnt = outData.length;
      const colCnt = outData[0].length;
      const outRng = sheet.getRange(ROW_DATA, COL_ID, rowCnt, colCnt);
      outRng.setValues(outData);
      outRng.setVerticalAlignment('top');

      LoadingUI.hint('表示を整えています…');
      for (let i = 0; i < rowCnt; i += 2) {
        sheet.getRange(ROW_DATA + i, COL_CHK, 1, colCnt + 1).setBackground('#FFFFEF');
      }
      Logger.log(`[search] end: ${Date.now() - start}ms`);
      return true;
    },
    update: () => {
      const start = Date.now();
      Logger.log('[update] start');

      LoadingUI.hint('更新対象を確認しています…');
      const sheet = getSheet();
      const rng = getDataRange(sheet);
      if (!rng) {
        Logger.log('[update] no target data');
        Browser.msgBox('更新対象のデータが見つかりません。');
        return false;
      }
      const values = rng.getValues();
      Logger.log(`[update] total rows to process: ${values.length}`);

      let rowIndex = 0;
      for (const row of values) {
        rowIndex++;
        let [isUpd, id, title, category, date, amount, shop, methodPay, url, note, expenseRatio] = row;
        if (!isUpd) continue;

        LoadingUI.hint(` ${rowIndex} 行目を処理しています…`);

        const rowStart = Date.now();
        Logger.log(`[update] row ${rowIndex}: processing id=${id || 'new'}, title=${title}, date=${date}`);

        LoadingUI.hint(` ${rowIndex} 行目の入力内容を確認しています…`);
        if (!title || !date) {
          Logger.log(`[update] invalid row data: ${JSON.stringify(row)}`);
          Browser.msgBox('入力内容を見直してください。');
          return false;
        }

        let icon = null;
        const startIdx = title.indexOf('(');
        if (startIdx > 0) {
          icon = title.slice(startIdx + 1, title.indexOf(')'));
          title = title.slice(0, startIdx);
        }

        LoadingUI.hint(` ${rowIndex} 行目の更新データを作成しています…`);
        const pageBuildStart = Date.now();
        const page = LocalUtils.getCreateSpending({
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
          dbUpdate: false,
        });
        Logger.log(`[update] row ${rowIndex}: built page in ${Date.now() - pageBuildStart}ms`);

        if (id) {
          // 更新
          LoadingUI.hint(` ${rowIndex} 行目を更新しています…`);
          const updateStart = Date.now();
          LocalUtils.updatePage(id, page, true);
          Logger.log(`[update] row ${rowIndex}: updated page in ${Date.now() - updateStart}ms`);
        } else {
          // 登録
          LoadingUI.hint(` ${rowIndex} 行目を新規登録しています…`);
          const createStart = Date.now();
          LocalUtils.createPage(page);
          Logger.log(`[update] row ${rowIndex}: created new page in ${Date.now() - createStart}ms`);
        }
        Logger.log(`[update] row updated in ${Date.now() - rowStart}ms`);
      }

      LoadingUI.hint('更新後の処理を完了しています…');
      Logger.log(`[update] end: ${Date.now() - start}ms`);
      return true;
    },
    delete: () => {
      const start = Date.now();
      Logger.log('[delete] start');
      const sheet = getSheet();
      const rng = getDataRange(sheet);
      if (!rng) {
        Logger.log('[delete] no target data');
        Browser.msgBox('削除対象のデータが見つかりません。');
        return false;
      }
      const values = rng.getValues();
      for (const row of values) {
        const [ isUpd, id ] = row;
        if (!isUpd) continue;
        LocalUtils.deletePage(id);
      }
      Logger.log(`[delete] end: ${Date.now() - start}ms`);
      return true;
    },
  }
})();

function OnClickSearchSpending() {
  return withLoading(function () {
    MainProcUpdate.search();
  }, {
    startHint: '検索中…',
    successHint: '検索完了！'
  });
}

function OnClickUpdateSpending() {
  return withLoading(function () {
    if (MainProcUpdate.update()) {
      MainProcUpdate.search();
    }
  }, {
    startHint: '更新中…',
    successHint: '更新完了！'
  });
}

function OnClickDeleteSpending() {
  return withLoading(function () {
    if (MainProcUpdate.delete()) {
      MainProcUpdate.search();
    }
  }, {
    startHint: '削除中…',
    successHint: '削除完了！'
  });
}

