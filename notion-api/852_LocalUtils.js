const LocalUtils = (function () {
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
