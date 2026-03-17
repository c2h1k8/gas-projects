const NotionApi = (function () {
  // プロパティ情報
  const props = PropertiesService.getScriptProperties().getProperties();

  const headers = {
    'Content-type': 'application/json',
    'Authorization': `Bearer ${props.NOTION_TOKEN}`,
    'Notion-Version': props.NOTION_VERSION,
  };

  const fetch = (url, options, needsLog) => {
    try {
      const res = UrlFetchApp.fetch(url, options);
      if (needsLog) Logger.log(res);
      Utilities.sleep(1000); // 平均3回/秒のリミット回避のためスリープ
      return JSON.parse(res);
    } catch (e) {
      Logger.log(e);
      throw e;
    }
  }

  /**
   * DB列情報を取得する
   * https://developers.notion.com/reference/retrieve-a-data-source
   */
  const getDatabaseColumnQuery = (dataSourceId, needsLog) => {
    const url = `https://api.notion.com/v1/data_sources/${dataSourceId}`
    const options = {
      'method' : 'GET',
      'headers': headers,
      'muteHttpExceptions' : true,
    };
    return fetch(url, options, needsLog);
  }

  /**
   * DBから指定条件に合うものを取得する
   * https://developers.notion.com/reference/query-a-data-source
   */
  const getDatabaseQuery = (dataSourceId, payload, needsLog) => {
    const url = `https://api.notion.com/v1/data_sources/${dataSourceId}/query`
    const options = {
      'method' : 'POST',
      'headers': headers,
      'payload': JSON.stringify(payload),
      'muteHttpExceptions' : true,
    };
    return fetch(url, options, needsLog);
  }

  const getPageFromId_ = (pageId, needsLog = false) => {
    const url = `https://api.notion.com/v1/pages/${pageId}`
    const options = {
      'method': 'GET',
      'headers': headers,
      'muteHttpExceptions' : true,
    };
    return fetch(url, options, needsLog);
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
      resultArray = resultArray.concat(resultQuery.results)
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
      const options = {
        'method' : 'POST',
        'headers': headers,
        'payload': JSON.stringify(page.toJson()),
        'muteHttpExceptions' : true,
      };
      return fetch(url, options, needsLog);
    },
    /**
     * ページの内容を更新する
     * https://developers.notion.com/reference/patch-page
     */
    updatePage: (pageId, page, needsLog = false) => {
      let payload = page.toJson();
      delete payload.children;
      const url = `https://api.notion.com/v1/pages/${pageId}`
      const options = {
        'method' : 'PATCH',
        'headers': headers,
        'payload': JSON.stringify(payload),
        'muteHttpExceptions' : true,
      };
      return fetch(url, options, needsLog);
    },
    /**
     * ページを削除する
     * https://developers.notion.com/reference/archive-a-page
     */
    deletePage: (pageId, needsLog = false) => {
      const url = `https://api.notion.com/v1/pages/${pageId}`
      const options = {
        'method' : 'PATCH',
        'headers': headers,
        'payload': JSON.stringify({
          'archived': true,
        }),
        'muteHttpExceptions' : true,
      };
      return fetch(url, options, needsLog);
    },
    /**
     * DBから指定条件に合うものを取得する
     * https://developers.notion.com/reference/query-a-data-source
     */
    getPages: getPages_,
    /**
     * ページIDからページ情報を取得する
     * @param pageId ページID
     * @return ページ
     */
    getPageFromId: getPageFromId_,
    /**
     * ページIDからタイトル名を取得する
     * @param pageId ページID
     * @param TITLE タイトル名
     * @return タイトル名
     */
    getTitleFromId: (pageId, { TITLE }, needsLog = false) => {
      const result = getPageFromId_(pageId, needsLog);
      return result.properties[TITLE]?.title?.[0].plain_text || '';
    },
    /**
     * タイトルからページIDを1件取得する
     * @param dataSourceId データソースID
     * @param TITLE タイトル名
     * @param value プロパティ値
     * @return ページID
     */
    getPageIdFromTitle: (dataSourceId, { TITLE }, value) => {
      const filterItems = [
        new NotionFilterItem(TITLE, 'title', 'equals', value),
      ];
      const resultQuery = getPages_(dataSourceId, new NotionFilter(filterItems));
      return resultQuery[0]?.id || '';
    },
    /**
     * DBから指定されたDBの列情報を取得する
     */
    getDbColumns: (dataSourceId, columns, needsLog = false) => {
      const resultQuery = getDatabaseColumnQuery(dataSourceId, needsLog);
      const columnArr = Array.isArray(columns) ? columns : [ columns ];
      return new Map(columnArr.map(col => [ col, resultQuery.properties[col] ]));
    },
  };
})();
