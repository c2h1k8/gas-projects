const LocalUtils = (function () {
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

  const safeParseGeminiJson = (text) => {
    if (!text) return null;

    // ```json や ``` を除去
    let cleaned = text
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim();

    // 最初の { から最後の } を抽出
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error("JSON not found in Gemini response");
    }

    return JSON.parse(match[0]);
  }

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
    deletePage: (pageId,needsLog = false) => {
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
    getPages: (dataSourceId, filter, needsLog = false, limit = 100) => {
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
    },
    /**
     * ページIDからページ情報を取得する
     * @param pageId ページID
     * @return ページ
     */
    getPageFromId: (pageId, needsLog = false) => {
      const url = `https://api.notion.com/v1/pages/${pageId}`
      const options = {
        'method': 'GET',
        'headers': headers,
        'muteHttpExceptions' : true,
      };
      return fetch(url, options, needsLog);
    },
    /**
     * ページIDからタイトル名を取得する
     * @param pageId ページID
     * @param TITLE タイトル名
     * @return タイトル名
     */
    getTitleFromId: (pageId, { TITLE }, needsLog = false) => {
      const result = LocalUtils.getPageFromId(pageId, needsLog);
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
      const resultQuery =  LocalUtils.getPages(dataSourceId, new NotionFilter(filterItems));
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
    /**
     * カレンダーから予定を取得する
     * @param calendarId カレンダーID
     * @param startDate 開始日
     * @param endDate 終了日
     * @return 予定マップ
     */
    getCalendarEvents: (calendarId, startDate, endDate = '') => {
      const cal = CalendarApp.getCalendarById(calendarId);
      const events = endDate ? cal.getEvents(startDate, endDate) : cal.getEventsForDay(startDate);
      const eventMap = new Map();
      
      for (let event of events) {
        const month = DateUtils.formatDate(event.getStartTime(), "yyyyMM");
        const startTime = DateUtils.formatDate(event.getStartTime(), "HH:mm");
        const endTime = DateUtils.formatDate(event.getEndTime(), "HH:mm");
        const time = startTime === endTime ? '終日' : `${startTime}~`;
        const items = eventMap.get(month) || [];
        items.push({
          day: DateUtils.formatDate(event.getStartTime(), "dd日"),
          time,
          title: event.getTitle(),
          location: event.getLocation().replace(/[〒]*[\d]{3}-[\d]{4}[\s\S]*/, '').trim(),
        });
        eventMap.set(month, items);
      }
      return eventMap;
    },
    /**
     * 支出登録用のデータを取得する
     * @param titile タイトル
     * @param category, カテゴリ
     * @param date 日付
     * @param amount 金額
     * @param shop お店
     * @param methodPay 支払方法
     * @param url URL
     * @param note 備考
     * @param icon アイコン
     * @return ページオブジェクト
     */
    getCreateSpending: ({ title, category, date, amount, shop, methodPay, url, note, icon, expenseRatio }) => {
      // プロパティ要素設定
      const propItem = new Map();
      propItem.set(Constants.PROPERTY_SPENDING.TITLE, new NotionPropTitle(title));
      propItem.set(Constants.PROPERTY_SPENDING.CATEGORY, new NotionPropSelect(category));
      propItem.set(Constants.PROPERTY_SPENDING.DATE, new NotionPropDate(date, false));
      propItem.set(Constants.PROPERTY_SPENDING.AMOUNT, new NotionPropNumber(amount));
      propItem.set(Constants.PROPERTY_SPENDING.SHOP, new NotionPropSelect(shop));
      propItem.set(Constants.PROPERTY_SPENDING.METHOD_PAY, new NotionPropSelect(methodPay));
      propItem.set(Constants.PROPERTY_SPENDING.URL, new NotionPropUrl(url));
      propItem.set(Constants.PROPERTY_SPENDING.NOTE, new NotionPropText(note));
      propItem.set(Constants.PROPERTY_SPENDING.EXPENSE_RATIO, new NotionPropNumber(expenseRatio));
      propItem.set(Constants.PROPERTY_SPENDING.DB_UPDATE_CHECKED, new NotionPropCheckBox(false));
      return new NotionPage(Props.getValue(PKeys.DATA_SOURCE_ID_SPENDING), propItem, icon);
    },
    /**
     * 収入登録用のデータを取得する
     * @param titile タイトル
     * @param date 日付
     * @param amount 金額
     * @param icon アイコン
     * @return ページオブジェクト
     */
    getCreateIncome: ({ title, date, amount, icon }) => {
      const propItem = new Map();
      propItem.set(Constants.PROPERTY_INCOME.TITLE, new NotionPropTitle(title));
      propItem.set(Constants.PROPERTY_INCOME.DATE, new NotionPropDate(date, false));
      propItem.set(Constants.PROPERTY_INCOME.AMOUNT, new NotionPropNumber(amount));
      propItem.set(Constants.PROPERTY_INCOME.DB_UPDATE_CHECKED, new NotionPropCheckBox(false));
      return new NotionPage(Props.getValue(PKeys.DATA_SOURCE_ID_INCOME), propItem, icon);
    },
    jsonStringify: (obj) => JSON.stringify(obj, (k, v) => (v instanceof Map ? { dataType: 'Map', value: [...v] } : v)),
    jsonParse: (obj) => {
      return JSON.parse(obj, (k, v) => {
        if (typeof v === "object" && v !== null) {
          if (v.dataType === "Map") {
            return new Map(v.value);
          }
        }
        return v;
      });
    },
    sort: (array, sortMap) => {
      array.sort((a, b) => {
        for (const [idx, isAsc] of sortMap) {
          let ret = isAsc ? 1 : -1;
          if (a[idx] > b[idx]) return ret;
          if (a[idx] < b[idx]) return -ret;
        }
        return 0;
      });
    },
    analyzeByGemini: (prompt) => {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${Props.getValue(PKeys.GEMINI_API_KEY)}`;
      const payload = {
        contents: [{
          parts: [{text: prompt}]
        }]
      };
      const res = UrlFetchApp.fetch(url, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(payload)
      });

      const json = JSON.parse(res.getContentText());
      const answer = json.candidates[0].content.parts[0].text;

      return safeParseGeminiJson(answer);
    },
    postText: (message, emojis = []) => {
      LineUtil.postText(Props.getValue(PKeys.LINE_CHANNEL_TOKEN), Props.getValue(PKeys.LINE_USER_ID), message, emojis);
    },
  };
})();