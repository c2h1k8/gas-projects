const NotionApi = (function () {
  const getHeaders = () => ({
    'Content-type': 'application/json',
    'Authorization': `Bearer ${Props.getValue('NOTION_TOKEN')}`,
    'Notion-Version': Props.getValue('NOTION_VERSION'),
  });

  const fetch = (url, options, needsLog) => {
    try {
      const response = UrlFetchApp.fetch(url, options);
      if (needsLog) Logger.log(response);
      Utilities.sleep(1000); // 平均3回/秒のリミット回避のためスリープ
      return JSON.parse(response);
    } catch (e) {
      Logger.log(e);
      throw e;
    }
  };

  const buildOptions = (method, payload = null) => {
    const options = {
      'method': method,
      'headers': getHeaders(),
      'muteHttpExceptions': true,
    };
    if (payload !== null) options.payload = JSON.stringify(payload);
    return options;
  };

  /**
   * DB列情報を取得する
   * https://developers.notion.com/reference/retrieve-a-data-source
   */
  const getDatabaseColumnQuery = (dataSourceId, needsLog) => {
    const url = `https://api.notion.com/v1/data_sources/${dataSourceId}`;
    return fetch(url, buildOptions('GET'), needsLog);
  };

  /**
   * DBから指定条件に合うものを取得する
   * https://developers.notion.com/reference/query-a-data-source
   */
  const getDatabaseQuery = (dataSourceId, payload, needsLog) => {
    const url = `https://api.notion.com/v1/data_sources/${dataSourceId}/query`;
    return fetch(url, buildOptions('POST', payload), needsLog);
  };

  const getPageFromId_ = (pageId, needsLog = false) => {
    const url = `https://api.notion.com/v1/pages/${pageId}`;
    return fetch(url, buildOptions('GET'), needsLog);
  };

  const getPages_ = (dataSourceId, filter, needsLog = false, limit = 100) => {
    let hasMore = true;
    let startCursor = null;
    let resultArray = [];
    const payload = filter ? filter.toJson() : {};

    while (hasMore) {
      payload.page_size = limit;
      if (startCursor !== null) payload.start_cursor = startCursor;
      const resultQuery = getDatabaseQuery(dataSourceId, payload, needsLog);
      hasMore = resultQuery.has_more;
      startCursor = resultQuery.next_cursor;
      resultArray = resultArray.concat(resultQuery.results);
    }
    return resultArray;
  };

  return {
    /**
     * ページの内容を登録する
     * https://developers.notion.com/reference/post-page
     */
    createPage: (page, needsLog = false) => {
      const url = 'https://api.notion.com/v1/pages';
      return fetch(url, buildOptions('POST', page.toJson()), needsLog);
    },
    /**
     * ページの内容を更新する
     * https://developers.notion.com/reference/patch-page
     */
    updatePage: (pageId, page, needsLog = false) => {
      const payload = page.toJson();
      delete payload.children;
      const url = `https://api.notion.com/v1/pages/${pageId}`;
      return fetch(url, buildOptions('PATCH', payload), needsLog);
    },
    /**
     * ページを削除する
     * https://developers.notion.com/reference/archive-a-page
     */
    deletePage: (pageId, needsLog = false) => {
      const url = `https://api.notion.com/v1/pages/${pageId}`;
      return fetch(url, buildOptions('PATCH', { archived: true }), needsLog);
    },
    /**
     * DBから指定条件に合うものを取得する
     * https://developers.notion.com/reference/query-a-data-source
     */
    getPages: getPages_,
    /**
     * ページIDからページ情報を取得する
     * @param {string} pageId ページID
     * @returns ページ
     */
    getPageFromId: getPageFromId_,
    /**
     * ページIDからタイトル名を取得する
     * @param {string} pageId ページID
     * @param {Object} columns タイトル列名
     * @returns {string} タイトル名
     */
    getTitleFromId: (pageId, { TITLE }, needsLog = false) => {
      const result = getPageFromId_(pageId, needsLog);
      return result.properties[TITLE]?.title?.[0].plain_text || '';
    },
    /**
     * タイトルからページIDを1件取得する
     * @param {string} dataSourceId データソースID
     * @param {Object} columns タイトル列名
     * @param {string} value プロパティ値
     * @returns {string} ページID
     */
    getPageIdFromTitle: (dataSourceId, { TITLE }, value) => {
      const resultQuery = getPages_(dataSourceId, new NotionFilter([new NotionFilterItem(TITLE, 'title', 'equals', value)]));
      return resultQuery[0]?.id || '';
    },
    /**
     * DBから指定されたDBの列情報を取得する
     * @param {string} dataSourceId データソースID
     * @param {string|string[]} columns 列名
     * @returns {Map} 列情報マップ
     */
    getDbColumns: (dataSourceId, columns, needsLog = false) => {
      const resultQuery = getDatabaseColumnQuery(dataSourceId, needsLog);
      const columnArr = Array.isArray(columns) ? columns : [columns];
      return new Map(columnArr.map(col => [col, resultQuery.properties[col]]));
    },
  };
})();
