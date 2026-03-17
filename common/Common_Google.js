const CommonGoogle = (function () {
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
     * Gemini API を使ってテキストを解析し、JSON を返す
     * @param prompt プロンプト
     * @param apiKey Gemini API キー
     * @return 解析結果オブジェクト
     */
    analyzeByGemini: (prompt, apiKey) => {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
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
  };
})();
