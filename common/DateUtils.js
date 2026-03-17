const DateUtils = (function () {
  const CAL_JA = 'ja.japanese.official#holiday@group.v.calendar.google.com';

  /**
   * 営業日かどうかを判定します。
   */
  const isBizDate_ = (targetDate) => {
    const calJa = CalendarApp.getCalendarById(CAL_JA);
    const dayOWeek = targetDate.getDay();
    if (dayOWeek === 0 || dayOWeek === 6 || calJa.getEventsForDay(targetDate).length > 0) {
      return false;
    }
    return true;
  };

  /**
   * 指定した曜日（および祝日）を含む日付を取得します。
   */
  const getDayFromWeek_ = (targetDate, { mon, tue, wed, thu, fri, sat, sun, hol }, isInclude, addDays) => {
    const calJa = CalendarApp.getCalendarById(CAL_JA);
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
    while (true) {
      const dayOWeek = tmpDate.getDay();
      if (targetWeeks.includes(dayOWeek) || (targetWeeks.includes(-1) && calJa.getEventsForDay(tmpDate).length > 0)) {
        return tmpDate;
      }
      tmpDate.setDate(tmpDate.getDate() + addDays);
    }
  };

  return {
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
      let i = 1;
      while (true) {
        if (!isBizDate_(prevDate)) {
          prevDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() - 1 * i++);
          continue;
        }
        return prevDate;
      }
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
      let i = 1;
      while (true) {
        if (!isBizDate_(nextDate)) {
          nextDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() + 1 * i++);
          continue;
        }
        return nextDate;
      }
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
