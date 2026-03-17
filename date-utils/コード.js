/**
 * 前営業日を取得します。
 * 
 * @param {Date} targetDate - 対象となる日付オブジェクト。
 * @param {boolean} [isInclude=true] - 対象日付を含むかどうか。デフォルトは含む（`true`）。
 * @returns {Date} - 前営業日の日付。
 * 
 * @example
 * const prevBizDate = getBizDatePrev(new Date());
 * console.log(prevBizDate); // 例: 2025-04-11
 */
function getBizDatePrev(targetDate, isInclude = true) {
  // 前営業日取得
  let prevDate = targetDate;
  if (!isInclude) {
    prevDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() - 1);
  }
  let i = 1;
  while (true) {
    if (!isBizDate(prevDate)) {
      // 土日祝日の場合、1日前に設定
      prevDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() - 1 * i++);
      continue;
    }
    return prevDate;
  }
}

/**
 * 前営業日を取得します。
 * 
 * @param {Date} targetDate - 対象となる日付オブジェクト。
 * @param {boolean} [isInclude=true] - 対象日付を含むかどうか。デフォルトは含む（`true`）。
 * @returns {Date} - 前営業日の日付。
 * 
 * @example
 * const prevBizDate = getBizDatePrev(new Date());
 * console.log(prevBizDate); // 例: 2025-04-11
 */
function getBizDateNext(targetDate, isInclude = true) {
  // 翌営業日取得
  let nextDate = targetDate;
  if (!isInclude) {
    nextDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() + 1);
  }
  let i = 1;
  while (true) {
    if (!isBizDate(nextDate)) {
      // 土日祝日の場合、1日後に設定
      nextDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() + 1 * i++);
      continue;
    }
    return nextDate;
  }
}

/**
 * 対象日から指定した直前の対象曜日を取得します。
 * 
 * @param {Date} targetDate - 対象となる日付オブジェクト。
 * @param {Object} daysOfWeek - 対象曜日を含むオブジェクト。例: `{mon: true, tue: false, wed: true}`。
 * @param {boolean} [isInclude=true] - 対象日付を含むかどうか。デフォルトは含む（`true`）。
 * @returns {Date} - 対象曜日に該当する直前の日付。
 * 
 * @example
 * const prevMonday = getPrevDayFromWeek(new Date(), {mon: true});
 * console.log(prevMonday); // 例: 2025-04-06 (月曜日)
 */
function getPrevDayFromWeek(targetDate, {mon, tue, wed, thu, fri, sat, sun, hol}, isInclude = true) {
  return getDayFromWeek(targetDate, {mon, tue, wed, thu, fri, sat, sun, hol}, isInclude, -1);
}

/**
 * 対象日から指定した直後の対象曜日を取得します。
 * 
 * @param {Date} targetDate - 対象となる日付オブジェクト。
 * @param {Object} daysOfWeek - 対象曜日を含むオブジェクト。例: `{mon: true, tue: false, wed: true}`。
 * @param {boolean} [isInclude=true] - 対象日付を含むかどうか。デフォルトは含む（`true`）。
 * @returns {Date} - 対象曜日に該当する直後の日付。
 * 
 * @example
 * const nextFriday = getNextDayFromWeek(new Date(), {fri: true});
 * console.log(nextFriday); // 例: 2025-04-18 (金曜日)
 */
function getNextDayFromWeek(targetDate, {mon, tue, wed, thu, fri, sat, sun, hol}, isInclude = true) {
  return getDayFromWeek(targetDate, {mon, tue, wed, thu, fri, sat, sun, hol}, isInclude, 1);
}

/**
 * 指定した曜日（および祝日）を含む日付を取得します。
 * 対象日から前後の日付を移動させながら、指定された曜日に一致する日付を検索します。
 * 祝日は日本の公式カレンダーを使用して判定します。
 * 
 * @param {Date} targetDate - 曜日を検索する基準となる日付オブジェクト。
 * @param {Object} daysOfWeek - 検索対象の曜日を指定するオブジェクト。
 * @param {boolean} isInclude - 基準日（`targetDate`）を含むかどうかを指定します。
 * @param {number} addDays - 日付を前後に移動させる日数。`-1` で前方（過去）の日付を、`1` で後方（未来）の日付を検索します。
 * 
 * @returns {Date} - 指定した曜日または祝日に該当する日付。
 * 
 * @example
 * const prevMonday = getDayFromWeek(new Date(), { mon: true, fri: true }, true, -1);
 * console.log(prevMonday); // 例: 2025-04-07 (月曜日)
 * 
 * @example
 * const nextHoliday = getDayFromWeek(new Date(), { hol: true }, false, 1);
 * console.log(nextHoliday); // 次の祝日の日付が表示されます。
 */
const getDayFromWeek = (targetDate, {mon, tue, wed, thu, fri, sat, sun, hol}, isInclude, addDays) => {
  // 日本の祝日カレンダー取得
  const calJa = CalendarApp.getCalendarById('ja.japanese.official#holiday@group.v.calendar.google.com');
  const targetWeeks =  [];
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
    // 曜日取得
    const dayOWeek = tmpDate.getDay();
    if (targetWeeks.includes(dayOWeek) || (targetWeeks.includes(-1) && calJa.getEventsForDay(tmpDate).length > 0)) {
      return tmpDate;
    }
    tmpDate.setDate(tmpDate.getDate() + addDays);
  }
}

/**
 * 営業日かどうかを判定します。
 * 
 * @param {Date} targetDate - 対象日付。
 * @returns {boolean} - 営業日かどうか。`true` は営業日、`false` は非営業日。
 * 
 * @example
 * const isBiz = isBizDate(new Date());
 * console.log(isBiz); // 例: true (営業日)
 */
function isBizDate(targetDate) {
  // 日本の祝日カレンダー取得
  const calJa = CalendarApp.getCalendarById('ja.japanese.official#holiday@group.v.calendar.google.com');
  const dayOWeek = targetDate.getDay();
  if (dayOWeek === 0 || dayOWeek === 6 || calJa.getEventsForDay(targetDate).length > 0) {
    // 土日祝日
    return false;
  }
  return true;
}

/**
 * 週番号から対象集の日付を取得します。
 * 
 * @param {Date} targetDate - 対象日付。
 * @param {number} weekNo - 週番号（1〜5）。
 * @returns {Date[]} - 対象週の開始日と終了日を含む日付配列。
 * 
 * @example
 * const weekDates = getDateFromWeekNo(new Date(), 2);
 * console.log(weekDates); // 例: [2025-04-06, 2025-04-12]
 */
function getDateFromWeekNo(targetDate, weekNo) {
  // 対象月取得
  const targetMonth = targetDate.getMonth();
  // 月初日取得
  const firstDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
  const dates = [ firstDate, firstDate ];
  dates[1] = getNextDayFromWeek(dates[0], { sat: true });
  if (weekNo === 1) {
    return dates;
  }
  for (let i = 2; i <= 5; i++) {
    // 週開始日取得
    dates[0] = getNextDayFromWeek(dates[0], { sun: true }, false);
    // 週終了日取得
    dates[1] = getNextDayFromWeek(dates[1], { sat: true }, false);
    if (weekNo === i) {
      if (dates[0].getMonth() !== targetMonth) {
        // 週開始日が当月ではない場合
        dates = undefined;
      } else if (dates[1].getMonth() !== targetMonth) {
        // 週終了日が当月ではない場合
        dates[1] = new Date(targetDate.getFullYear(), targetMonth + 1, 0);
      }
      return dates
    }
  }
  
  return dates;
}

/**
 * 曜日を取得します。
 * 
 * @param {Date} date - 日付オブジェクト。
 * @returns {string} - 曜日（例: '日', '月', '火', '水', '木', '金', '土'）。
 * 
 * @example
 * const weekday = getDayOfWeek(new Date());
 * console.log(weekday); // 例: '月'
 */
function getDayOfWeek(date) {
  switch(date.getDay()) {
    case 0: return '日';
    case 1: return '月';
    case 2: return '火';
    case 3: return '水';
    case 4: return '木';
    case 5: return '金';
    case 6: return '土';
  }
}

/**
 * 指定した日付を、指定したフォーマットに基づいて文字列として返します。
 * 
 * @param {Date} date - フォーマットする日付オブジェクト。
 * @param {string} [format='yyyy-MM-dd HH:mm:ss'] - 日付と時刻をどのように表示するかを決定するフォーマット文字列。
 *   - `yyyy` : 年（4桁）
 *   - `MM`   : 月（2桁）
 *   - `dd`   : 日（2桁）
 *   - `HH`   : 時（24時間制、ゼロ埋め）
 *   - `hh`   : 時（12時間制、ゼロ埋め）
 *   - `mm`   : 分（ゼロ埋め）
 *   - `ss`   : 秒（ゼロ埋め）
 *   - `M`    : 月（1桁）
 *   - `d`    : 日（1桁）
 *   - `H`    : 時（24時間制、ゼロなし）
 *   - `h`    : 時（12時間制、ゼロなし）
 *   - `m`    : 分（1桁）
 *   - `s`    : 秒（1桁）
 *   - `aaa`  : 曜日（日本語の省略、例: 土）
 *   - `aaaa` : 曜日（日本語のフル、例: 土曜日）
 *   - `ddd`  : 曜日（英語の省略、例: Sat）
 *   - `dddd` : 曜日（英語のフル、例: Saturday）
 * @returns {string} フォーマットされた日付文字列。
 * 
 * @example
 * const now = new Date();
 * console.log(formatDate(now, "yyyy-MM-dd (ddd) HH:mm:ss"));  // 例: 2025-04-12 (Sat) 14:30:15
 * console.log(formatDate(now, "hh:mm:ss"));                  // 例: 02:30:15
 */
function formatDate(date, format = 'yyyy-MM-dd HH:mm:ss') {
  const padZero = (num) => num.toString().padStart(2, '0');

  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = date.getHours();
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  const minute = date.getMinutes();
  const second = date.getSeconds();

  const weekDaysJaShort = ['日', '月', '火', '水', '木', '金', '土'];
  const weekDaysJaLong = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'];
  const weekDaysEnShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weekDaysEnLong = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dow = date.getDay();

  return format
    .replaceAll('yyyy', year)
    .replaceAll("dddd", weekDaysEnLong[dow])
    .replaceAll("ddd", weekDaysEnShort[dow])
    .replaceAll("aaaa", weekDaysJaLong[dow])
    .replaceAll("aaa", weekDaysJaShort[dow])
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
}
