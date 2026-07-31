const DateUtils = (function () {
  const CAL_JA = 'ja.japanese.official#holiday@group.v.calendar.google.com';
  const MAX_SEARCH_DAYS = 365;

  // 祝日はカレンダーAPIを日ごとに呼ぶと呼び出し回数が日数分に比例するため、
  // 月単位でまとめて取得して実行中はキャッシュする（'yyyy-MM' → 祝日の'yyyy-MM-dd'のSet）。
  const _holidayCache = new Map();
  let _calJa = null;

  const getCalJa_ = () => _calJa || (_calJa = CalendarApp.getCalendarById(CAL_JA));

  const ymKey_ = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  const ymdKey_ = (date) => `${ymKey_(date)}-${String(date.getDate()).padStart(2, '0')}`;

  /**
   * 指定日が属する月の祝日を1回のAPI呼び出しで取得します（キャッシュあり）。
   */
  const getHolidays_ = (targetDate) => {
    const key = ymKey_(targetDate);
    if (_holidayCache.has(key)) return _holidayCache.get(key);

    const from = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
    const to = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 1);
    const days = new Set();
    for (const event of getCalJa_().getEvents(from, to)) {
      // 終日イベントの終了日時は翌日0時のため、開始日から終了直前までを1日ずつ展開する
      const start = event.getStartTime();
      const end = event.getEndTime();
      let added = false;
      for (let d = new Date(start.getFullYear(), start.getMonth(), start.getDate()); d < end; d.setDate(d.getDate() + 1)) {
        days.add(ymdKey_(d));
        added = true;
      }
      if (!added) days.add(ymdKey_(start));
    }
    _holidayCache.set(key, days);
    return days;
  };

  /**
   * 祝日かどうかを判定します。
   */
  const isHoliday_ = (targetDate) => getHolidays_(targetDate).has(ymdKey_(targetDate));

  /**
   * 営業日かどうかを判定します。
   */
  const isBizDate_ = (targetDate) => {
    const dayOWeek = targetDate.getDay();
    if (dayOWeek === 0 || dayOWeek === 6) return false;
    return !isHoliday_(targetDate);
  };

  /**
   * 指定した曜日（および祝日）を含む日付を取得します。
   */
  const getDayFromWeek_ = (targetDate, { mon, tue, wed, thu, fri, sat, sun, hol }, isInclude, addDays) => {
    const targetWeeks = [];
    if (sun) targetWeeks.push(0);
    if (mon) targetWeeks.push(1);
    if (tue) targetWeeks.push(2);
    if (wed) targetWeeks.push(3);
    if (thu) targetWeeks.push(4);
    if (fri) targetWeeks.push(5);
    if (sat) targetWeeks.push(6);
    if (hol) targetWeeks.push(-1);
    let tmpDate = new Date(targetDate);
    if (!isInclude) {
      tmpDate.setDate(tmpDate.getDate() + addDays);
    }
    for (let count = 0; count < MAX_SEARCH_DAYS; count++) {
      const dayOWeek = tmpDate.getDay();
      if (targetWeeks.includes(dayOWeek) || (targetWeeks.includes(-1) && isHoliday_(tmpDate))) {
        return tmpDate;
      }
      tmpDate.setDate(tmpDate.getDate() + addDays);
    }
    throw new Error(`対象曜日が見つかりません: ${DateUtils.formatDate(targetDate)}`);
  };

  return {
    /**
     * 営業日かどうかを判定します。
     * @param {Date} targetDate
     * @returns {boolean}
     */
    isBizDate: (targetDate) => isBizDate_(targetDate),

    /**
     * 前営業日を取得します。
     * @param {Date} targetDate
     * @param {boolean} [isInclude=true] 対象日付を含むかどうか
     * @returns {Date}
     */
    getBizDatePrev: (targetDate, isInclude = true) => {
      let prevDate = targetDate;
      if (!isInclude) {
        prevDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() - 1);
      }
      for (let i = 0; i < MAX_SEARCH_DAYS; i++) {
        if (isBizDate_(prevDate)) return prevDate;
        prevDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() - i - 1);
      }
      throw new Error(`前営業日が見つかりません: ${DateUtils.formatDate(targetDate)}`);
    },

    /**
     * 翌営業日を取得します。
     * @param {Date} targetDate
     * @param {boolean} [isInclude=true] 対象日付を含むかどうか
     * @returns {Date}
     */
    getBizDateNext: (targetDate, isInclude = true) => {
      let nextDate = targetDate;
      if (!isInclude) {
        nextDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() + 1);
      }
      for (let i = 0; i < MAX_SEARCH_DAYS; i++) {
        if (isBizDate_(nextDate)) return nextDate;
        nextDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() + i + 1);
      }
      throw new Error(`翌営業日が見つかりません: ${DateUtils.formatDate(targetDate)}`);
    },

    /**
     * 対象日から指定した直前の対象曜日を取得します。
     * @param {Date} targetDate
     * @param {Object} daysOfWeek
     * @param {boolean} [isInclude=true]
     * @returns {Date}
     */
    getPrevDayFromWeek: (targetDate, { mon, tue, wed, thu, fri, sat, sun, hol }, isInclude = true) => {
      return getDayFromWeek_(targetDate, { mon, tue, wed, thu, fri, sat, sun, hol }, isInclude, -1);
    },

    /**
     * 対象日から指定した直後の対象曜日を取得します。
     * @param {Date} targetDate
     * @param {Object} daysOfWeek
     * @param {boolean} [isInclude=true]
     * @returns {Date}
     */
    getNextDayFromWeek: (targetDate, { mon, tue, wed, thu, fri, sat, sun, hol }, isInclude = true) => {
      return getDayFromWeek_(targetDate, { mon, tue, wed, thu, fri, sat, sun, hol }, isInclude, 1);
    },

    /**
     * 週番号から対象週の日付を取得します。
     * @param {Date} targetDate
     * @param {number} weekNo 週番号（1〜5）
     * @returns {Date[]}
     */
    getDateFromWeekNo: (targetDate, weekNo) => {
      const targetMonth = targetDate.getMonth();
      const firstDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
      let dates = [firstDate, firstDate];
      dates[1] = DateUtils.getNextDayFromWeek(dates[0], { sat: true });
      if (weekNo === 1) {
        return dates;
      }
      for (let i = 2; i <= 5; i++) {
        dates[0] = DateUtils.getNextDayFromWeek(dates[0], { sun: true }, false);
        dates[1] = DateUtils.getNextDayFromWeek(dates[1], { sat: true }, false);
        if (weekNo === i) {
          if (dates[0].getMonth() !== targetMonth) {
            dates = undefined;
          } else if (dates[1].getMonth() !== targetMonth) {
            dates[1] = new Date(targetDate.getFullYear(), targetMonth + 1, 0);
          }
          return dates;
        }
      }
      return dates;
    },

    /**
     * 曜日を取得します。
     * @param {Date} date
     * @returns {string} 曜日（例: '月'）
     */
    getDayOfWeek: (date) => {
      return ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];
    },

    /**
     * 指定した日付を、指定したフォーマットに基づいて文字列として返します。
     * @param {Date} date
     * @param {string} [format='yyyy-MM-dd HH:mm:ss']
     * @returns {string}
     */
    formatDate: (date, format = 'yyyy-MM-dd HH:mm:ss') => {
      const padZero = (num) => num.toString().padStart(2, '0');
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const hour = date.getHours();
      const hour12 = hour % 12 === 0 ? 12 : hour % 12;
      const minute = date.getMinutes();
      const second = date.getSeconds();
      const dow = date.getDay();
      const weekDaysJaShort = ['日', '月', '火', '水', '木', '金', '土'];
      const weekDaysJaLong = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'];
      const weekDaysEnShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const weekDaysEnLong = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      return format
        .replaceAll('yyyy', year)
        .replaceAll('dddd', weekDaysEnLong[dow])
        .replaceAll('ddd', weekDaysEnShort[dow])
        .replaceAll('aaaa', weekDaysJaLong[dow])
        .replaceAll('aaa', weekDaysJaShort[dow])
        .replaceAll('MM', padZero(month))
        .replaceAll('dd', padZero(day))
        .replaceAll('HH', padZero(hour))
        .replaceAll('hh', padZero(hour12))
        .replaceAll('mm', padZero(minute))
        .replaceAll('ss', padZero(second))
        .replaceAll('M', month)
        .replaceAll('d', day)
        .replaceAll('H', hour)
        .replaceAll('h', hour12)
        .replaceAll('m', minute)
        .replaceAll('s', second);
    },
  };
})();
