const MainProcInventoryControl = (function () {
  const props = PropertiesService.getScriptProperties().getProperties();
  const SHEET_NAME = '在庫管理';
  const ROW_HEADER = 2;
  const ROW_DATA = 3;
  const COL_CHK = 2;
  const IDX_COL_CHK = 0;
  const IDX_COL_TITLE = 1;
  const IDX_COL_ICON = 2;
  const IDX_COL_STOCK_CNT = 3;
  const IDX_COL_DISCOUNT = 4;
  const IDX_COL_PRICE = 5;
  const IDX_COL_CAPACITY = 6;
  const IDX_COL_URL = 7;
  const IDX_COL_STOCK_TYPE = 8;
  const RNG_SEARCH_CONDIITON_FROM = 'M6';
  const RNG_SEARCH_CONDIITON_TO = 'M7';

  const makePage = ({ title, icon, stockCnt, discount, price, capacity, url, stockType}) => {
    const now = new Date();
    // 在庫ID取得
    const stockTypeId = LocalUtils.getPageIdFromTitle(
      LocalUtils.getDatabaseId(now.getFullYear(), Constants.DATABASE_ID.ANNUAL_STOCK), Constants.PROPERTY_ANNUAL_STOCK, stockType);
    // プロパティ要素設定
    const propItem = new Map();
    propItem.set(Constants.PROPERTY_STOCK_MANAGEMENT.TITLE, new PropTitle(title));
    propItem.set(Constants.PROPERTY_STOCK_MANAGEMENT.STOCK_CNT, new PropNumber(stockCnt));
    propItem.set(Constants.PROPERTY_STOCK_MANAGEMENT.DISCOUNT, new PropSelect(discount * 100 + '%'));
    propItem.set(Constants.PROPERTY_STOCK_MANAGEMENT.PRICE, new PropNumber(price));
    propItem.set(Constants.PROPERTY_STOCK_MANAGEMENT.CAPACITY, new PropNumber(capacity));
    propItem.set(Constants.PROPERTY_STOCK_MANAGEMENT.URL, new PropUrl(url));
    propItem.set(Constants.PROPERTY_STOCK_MANAGEMENT.STOCK_TYPE, new PropRelation(stockTypeId));
    propItem.set(Constants.PROPERTY_STOCK_MANAGEMENT.CONFIRM_DATE, new PropDate(now, false));
    return new Page(LocalUtils.getDatabaseId(now.getFullYear(), Constants.DATABASE_ID.STOCK_MANAGEMENT), propItem, icon);
  }

  const getDataRange = () => {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    const rowCnt = Utils.getEndRow(sheet, COL_CHK) - ROW_HEADER;
    const colCnt = Utils.getEndCol(sheet, ROW_HEADER) - COL_CHK + 1;
    if (rowCnt === 0) {
      return undefined;
    }
    return sheet.getRange(ROW_DATA, COL_CHK, rowCnt, colCnt);
  }

  return {
    search: () => {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
      // 既存情報クリア
      const rng = getDataRange();
      if (rng) {
        rng.clearContent();
      }
      // 検索条件設定
      const periodFrom = sheet.getRange(RNG_SEARCH_CONDIITON_FROM).getValue();
      const periodTo = sheet.getRange(RNG_SEARCH_CONDIITON_TO).getValue();
      const filterItems = [];
      if (periodFrom) {
        filterItems.push(new FilterItem(Constants.PROPERTY_STOCK_MANAGEMENT.CONFIRM_DATE, 'date', 'on_or_after', periodFrom));
      }
      if (periodTo) {
        filterItems.push(new FilterItem(Constants.PROPERTY_STOCK_MANAGEMENT.CONFIRM_DATE, 'date', 'on_or_before', periodTo));
      }
      const outValues = [];
      const databaseIdMap = LocalUtils.getDatabaseIdMap(Constants.DATABASE_ID.STOCK_MANAGEMENT);
      let resultArray = []
      for (const [year, databaseId] of databaseIdMap) {
        if (periodFrom && periodFrom.getFullYear() > year) continue;
        if (periodTo && periodTo.getFullYear() < year) continue;
        const resultQuery = LocalUtils.getPages(databaseId, new Filter(filterItems));
        // 検索結果格納
        resultArray = resultArray.concat(resultQuery);
      }
      for (const item of resultArray) {
        const outItems = [];
        outItems.push(true);
        outItems.push(item.properties[Constants.PROPERTY_STOCK_MANAGEMENT.TITLE].title[0].plain_text);
        outItems.push(item.icon.emoji);
        outItems.push(item.properties[Constants.PROPERTY_STOCK_MANAGEMENT.STOCK_CNT].number);
        outItems.push(item.properties[Constants.PROPERTY_STOCK_MANAGEMENT.DISCOUNT].select.name);
        outItems.push(item.properties[Constants.PROPERTY_STOCK_MANAGEMENT.PRICE].number);
        outItems.push(item.properties[Constants.PROPERTY_STOCK_MANAGEMENT.CAPACITY].number);
        outItems.push(item.properties[Constants.PROPERTY_STOCK_MANAGEMENT.URL].url);
        const stockId = item.properties[Constants.PROPERTY_STOCK_MANAGEMENT.STOCK_TYPE].relation[0].id;
        outItems.push(LocalUtils.getTitleFromId(stockId, Constants.PROPERTY_ANNUAL_STOCK));
        outValues.push(outItems);
        Logger.log(outItems);
      }
      sheet.getRange(ROW_DATA, COL_CHK, outValues.length, outValues[0].length).setValues(outValues);
    },
    regist: () => {
      const rng = getDataRange();
      if (!rng) {
        Logger.log('登録データがありません。');
        return;
      }

      for (const data of rng.getValues()) {
        // 登録可否判定
        if (!data[IDX_COL_CHK]) {
          continue;
        }
        const page = makePage({
          'title': data[IDX_COL_TITLE],
          'icon': data[IDX_COL_ICON],
          'stockCnt': data[IDX_COL_STOCK_CNT],
          'discount': data[IDX_COL_DISCOUNT],
          'price': data[IDX_COL_PRICE],
          'capacity': data[IDX_COL_CAPACITY],
          'url': data[IDX_COL_URL],
          'stockType': data[IDX_COL_STOCK_TYPE],
        });
        if (page) {
          LocalUtils.createPage(page);
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

/**
 * 在庫管理登録
 */
function OnClickRegistStock() {
  LocalUtils.showLoading();
  try {
    MainProcInventoryControl.regist();
  } catch (e) {
    // MainProcInventoryControl.error(e);
  }
  LocalUtils.closeLoading();
}

/**
 * 在庫管理検索
 */
function OnClickSearchStock() {
  LocalUtils.showLoading();
  MainProcInventoryControl.search();
  LocalUtils.closeLoading();
}
