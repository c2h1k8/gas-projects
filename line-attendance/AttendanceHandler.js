const MainProc = (function () {
  const COLUMN_META = {
    DAY: { NO: 1, IDX: 0 },
    TYPE: { NO: 5, IDX: 4 },
    START: { NO: 9, IDX: 8 },
    END: { NO: 12, IDX: 11 },
    DIFF: { NO: 30, IDX: 29 },
  }
  const RNG_TTL = 'AD44';
  const TYPE = {
    WORKING: '出勤',
    REST: '欠勤',
    HOLIDAY: '有給休暇',
    DAIKYU: '代休',
    HOLIDAY_WORKING: '休日出勤',
    CLEAR: 'クリア',
  }
  const TYPE_CD = {
    r: 'REST',
    h: 'HOLIDAY',
    d: 'DAIKYU',
    w: 'HOLIDAY_WORKING',
    c: 'CLEAR',
  }
  const ABSENCE_TYPE = {
    REST: {
      KEY: 'REST',
      LABEL: '通常休',
      SUBJECT: '【欠勤連絡】',
      USE_PERIOD: true,
    },
    WORK_REST: {
      KEY: 'WORK_REST',
      LABEL: '客先休',
      SUBJECT: '【客先休業日/欠勤】',
      USE_PERIOD: true,
    },
    OVER_WORK: {
      KEY: 'OVER_WORK',
      LABEL: '深夜作業',
      SUBJECT: '【深夜作業連絡】',
      USE_PERIOD: false,
    },
    LATE_WORK: {
      KEY: 'LATE_WORK',
      LABEL: '遅刻',
      SUBJECT: '【遅刻連絡】',
      USE_PERIOD: false,
    },
    EARLY_WORK: {
      KEY: 'EARLY_WORK',
      LABEL: '早退',
      SUBJECT: '【早退連絡】',
      USE_PERIOD: false,
    },
    HOLIDAY_WORK: {
      KEY: 'HOLIDAY_WORK',
      LABEL: '休出',
      SUBJECT: '【休日出勤連絡】',
      USE_PERIOD: true,
    },
  }

  // 勤怠連絡カテゴリ（連絡済み判定・連絡漏れ監視で使用）
  const CONTACT_CATEGORY = {
    ABSENCE: 'ABSENCE',       // 欠勤系（通常休/客先休/有給/代休）
    OVER_WORK: 'OVER_WORK',   // 深夜作業
    HOLIDAY_WORK: 'HOLIDAY_WORK', // 休出
    LATE_WORK: 'LATE_WORK',   // 遅刻
    EARLY_WORK: 'EARLY_WORK', // 早退
  };
  // 勤怠連絡種別（ABSENCE_TYPEのKEY） → カテゴリ
  const CONTACT_CATEGORY_BY_TYPE = {
    REST: CONTACT_CATEGORY.ABSENCE,
    WORK_REST: CONTACT_CATEGORY.ABSENCE,
    OVER_WORK: CONTACT_CATEGORY.OVER_WORK,
    HOLIDAY_WORK: CONTACT_CATEGORY.HOLIDAY_WORK,
    LATE_WORK: CONTACT_CATEGORY.LATE_WORK,
    EARLY_WORK: CONTACT_CATEGORY.EARLY_WORK,
  };

  // テストモードフラグ（スプレッドシート操作をスキップする）
  let _testMode = false;

  const buildSignature_ = () => [
    '',
    '╋┿╋┿╋┿╋┿╋┿╋┿╋┿╋┿╋┿╋┿╋┿╋┿╋┿╋',
    `╋┿╋┿　　${Props.getValue(PKeys.COMPANY_NAME)}`,
    `╋┿╋　　　${Props.getValue(PKeys.NAME_LAST)} ${Props.getValue(PKeys.NAME_FIRST)} / ${Props.getValue(PKeys.NAME_ALPHA)}`,
    `╋┿　　　　${Props.getValue(PKeys.COMPANY_POST_CD)}`,
    `╋　　　　　${Props.getValue(PKeys.COMPANY_ADDRESS)}`,
    `╋　　　　　TEL: ${Props.getValue(PKeys.COMPANY_TEL)}`,
    `╋　　　　　Email: ${Props.getValue(PKeys.ADDRESS_FROM)}`,
    `╋　　　　　URL: ${Props.getValue(PKeys.COMPANY_URL)}`,
    '╋┿╋┿╋┿╋┿╋┿╋┿╋┿╋┿╋┿╋┿╋┿╋┿╋┿╋',
  ].join('\n');

  const getMailConfig_ = () => ({
    from: Props.getValue(PKeys.ADDRESS_FROM),
    displayName: `${Props.getValue(PKeys.COMPANY_NAME)} ${Props.getValue(PKeys.NAME_LAST)} ${Props.getValue(PKeys.NAME_FIRST)}`,
  });

  /**
   * 日時から時刻を取得します。
   * @param date 日時
   * @return 時刻
   */
  const getTime = (date) => date ? DateUtils.formatDate(date, 'HH:mm') : date

  /**
   * 時間を分に変換します。
   * @param time 時間
   * @return 分
   */
  const convertHour2Minutes = (time) => {
    const [h , m] = time.split(':').map(Number);
    return h * 60 + m;
  }

  /**
   * 分を時間に変換します。
   * @param minutes 分
   * @return 時間
   */
  const convertMinutes2Hour = (minutes) => {
    const h = Math.trunc(minutes / 60);
    const m = minutes % 60;
    return `${h}:${String(m).padStart(2, "0")}`;
  }

  // ===== 遅刻/早退/深夜の判定（勤務表の工数計算と同じ丸め基準） =====
  // 工数は ROUND_UNIT_CALC 単位で「開始=切り上げ／終了=切り捨て」して計算されるため、
  // 遅刻/早退/深夜もその丸め後の実働時刻で判定する。

  const hasTime = (t) => t && t !== '-';
  const calcUnit = () => Math.abs(Number(Props.getValue(PKeys.ROUND_UNIT_CALC)) || 0);
  /** 出社時刻を切り上げた実働開始（分） */
  const effStartMin = (start) => {
    const unit = calcUnit();
    const m = convertHour2Minutes(start);
    return unit > 0 ? Math.ceil(m / unit) * unit : m;
  };
  /** 退社時刻を切り捨てた実働終了（分） */
  const effEndMin = (end) => {
    const unit = calcUnit();
    const m = convertHour2Minutes(end);
    return unit > 0 ? Math.floor(m / unit) * unit : m;
  };
  /** 実働開始がデフォルト出社時刻より遅い（＝遅刻） */
  const isLateStart = (start) => hasTime(start) && effStartMin(start) > convertHour2Minutes(Props.getValue(PKeys.START_TIME_DEFAULT));
  /** 実働終了がデフォルト退社時刻より早い（＝早退） */
  const isEarlyEnd = (end) => hasTime(end) && effEndMin(end) < convertHour2Minutes(Props.getValue(PKeys.END_TIME_DEFAULT));
  /** 実働終了が22時以降（＝深夜作業） */
  const isOverWorkEnd = (end) => hasTime(end) && effEndMin(end) >= 22 * 60;

  // ===== 履歴の保持管理 =====

  /**
   * 当月より前の日付エントリ（'yyyy-MM-dd'キー）を削除します。
   * @return 削除があればtrue
   */
  const pruneOldEntries = (map) => {
    const curYm = DateUtils.formatDate(new Date(), 'yyyy-MM');
    let removed = false;
    for (const key of map.keys()) {
      if (typeof key === 'string' && key.slice(0, 7) < curYm) {
        map.delete(key);
        removed = true;
      }
    }
    return removed;
  };

  // ===== 勤怠開始/終了のLINE登録履歴（PUNCH_LOG） =====

  const getPunchLog = () => Props.getJson(PKeys.PUNCH_LOG) || new Map();

  /**
   * 勤怠開始/終了のLINE登録を記録します（既存の登録はOR合成）。
   * @param date 対象日
   * @param flags { start: 開始登録あり, end: 終了登録あり }
   */
  const recordPunch = (date, { start, end }) => {
    if (_testMode) return;
    const key = DateUtils.formatDate(date, 'yyyy-MM-dd');
    const log = getPunchLog();
    pruneOldEntries(log);
    const cur = log.get(key) || { start: false, end: false };
    cur.start = cur.start || !!start;
    cur.end = cur.end || !!end;
    log.set(key, cur);
    Props.setJson(PKeys.PUNCH_LOG, log);
  };

  /**
   * 勤怠登録履歴を削除します（クリア時）。
   * @param date 対象日
   */
  const clearPunch = (date) => {
    if (_testMode) return;
    const key = DateUtils.formatDate(date, 'yyyy-MM-dd');
    const log = getPunchLog();
    if (log.has(key)) {
      log.delete(key);
      Props.setJson(PKeys.PUNCH_LOG, log);
    }
  };

  // ===== 勤怠連絡の送信履歴（SENT_CONTACTS） =====

  const getSentContacts = () => Props.getJson(PKeys.SENT_CONTACTS) || new Map();

  /**
   * 指定日が該当カテゴリで連絡済みかを判定します。
   * @param dateStr 'yyyy-MM-dd'
   * @param category 連絡カテゴリ
   */
  const isContacted = (dateStr, category) => {
    const arr = getSentContacts().get(dateStr);
    return Array.isArray(arr) && arr.includes(category);
  };

  /**
   * 勤怠連絡の送信を記録します。
   * @param dateStrList 'yyyy-MM-dd'の配列
   * @param category 連絡カテゴリ
   */
  const recordContacts = (dateStrList, category) => {
    if (_testMode) return;
    const contacts = getSentContacts();
    pruneOldEntries(contacts);
    for (const dateStr of dateStrList) {
      const arr = contacts.get(dateStr) || [];
      if (!arr.includes(category)) arr.push(category);
      contacts.set(dateStr, arr);
    }
    Props.setJson(PKeys.SENT_CONTACTS, contacts);
  };

  /**
   * 登録内容から必要な勤怠連絡カテゴリの配列を返します。
   * @param type 勤怠区分（更新後）
   * @param start 出社時刻（'HH:mm' / '-' / ''）
   * @param end 退社時刻（'HH:mm' / '-' / ''）
   * @param startProvided 今回のLINE登録で出社を入力したか
   * @param endProvided 今回のLINE登録で退社を入力したか
   */
  const neededContactCategories = (type, start, end, startProvided, endProvided) => {
    switch (type) {
      case TYPE.REST:
      case TYPE.HOLIDAY:
      case TYPE.DAIKYU:
        return [CONTACT_CATEGORY.ABSENCE];
      case TYPE.HOLIDAY_WORKING: {
        const cats = [CONTACT_CATEGORY.HOLIDAY_WORK];
        if (endProvided && isOverWorkEnd(end)) cats.push(CONTACT_CATEGORY.OVER_WORK);
        return cats;
      }
      case TYPE.WORKING: {
        const cats = [];
        if (startProvided && isLateStart(start)) cats.push(CONTACT_CATEGORY.LATE_WORK);
        if (endProvided && isOverWorkEnd(end)) cats.push(CONTACT_CATEGORY.OVER_WORK);
        if (endProvided && isEarlyEnd(end)) cats.push(CONTACT_CATEGORY.EARLY_WORK);
        return cats;
      }
      default:
        return [];
    }
  };

  /**
   * 開始日〜終了日の'yyyy-MM-dd'配列を返します（終了日省略時は開始日のみ）。
   */
  const buildDateRange = (fromStr, toStr) => {
    const from = Utilities.parseDate(fromStr, 'JST', 'yyyy-MM-dd');
    const to = toStr ? Utilities.parseDate(toStr, 'JST', 'yyyy-MM-dd') : from;
    const out = [];
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      out.push(DateUtils.formatDate(d, 'yyyy-MM-dd'));
    }
    return out;
  };

  /**
   * ヘルプを送信します。
   * @param replyToken リプライトークン
   */
  const displayHelp = (replyToken) => {
    const typeList = Object.keys(TYPE_CD).map((cd) => ({ cd, label: TYPE[TYPE_CD[cd]] }));
    LineManager.replyFlex(replyToken, 'ヘルプ', FlexCards.help(typeList));
  }

  /**
   * 勤怠一覧を表示します。
   * @param replyToken リプライトークン
   * @param diffMonths 差分月数
   */
  const displayAttendanceReport = (replyToken, diffMonths = '') => {
    let date = new Date();
    if (/^\d+$/.test(diffMonths)) {
      // 差分月指定がある場合、指定月分減算する。
      date = new Date(date.getFullYear(), date.getMonth() - Number(diffMonths) + 1, 0);
    }
    // ファイル取得
    const ssFile = getFile(date);
    if (!ssFile) {
      postErrMsgFileNotFound(replyToken, date);
      return;
    }
    const { totalTime, workDays, diffTotal, rows } = calculateTotalTime(ssFile, date);
    const summary = summaryData(totalTime, workDays, diffTotal, diffMonths === '');
    const card = FlexCards.list({
      title: `${DateUtils.formatDate(date, 'yyyy年 M月')} 稼働`,
      total: summary.total,
      overtime: summary.overtime,
      forecast: summary.forecast,
      rows: rows.filter((r) => r.worked),
    });
    LineManager.replyFlex(replyToken, `${DateUtils.formatDate(date, 'yyyy年M月')} 稼働`, card);
  }

  /**
   * 指定日の月の集計データ（文字列）を返します。
   * @return {{ total, overtime, forecast }} forecastはnull可
   */
  const getMonthSummaryData = (date) => {
    const ssFile = getFile(date);
    const { totalTime, workDays, diffTotal } = calculateTotalTime(ssFile, date);
    // 最終営業日ではない場合、見込み時間を出す
    const lastBizDate = DateUtils.getBizDatePrev(new Date(date.getFullYear(), date.getMonth() + 1, 1), false);
    const showForecast = date.getDate() < lastBizDate.getDate();
    return summaryData(totalTime, workDays, diffTotal, showForecast);
  }

  const summaryData = (totalTime, workDays, diffTotal, showForecast) => {
    let forecast = null;
    if (showForecast) {
      const forecastHour = (totalTime.getDate() + 1) * 24 + totalTime.getHours();
      const forecastMin = DateUtils.formatDate(totalTime, 'mm');
      forecast = `${forecastHour}:${forecastMin}`;
    }
    const overtime = diffTotal - workDays * 8 * 60;
    return {
      total: convertMinutes2Hour(diffTotal),
      overtime: convertMinutes2Hour(overtime),
      forecast,
    };
  };

  const calculateTotalTime = (ssFile, date) => {
    const sheet = SpreadsheetApp.openById(ssFile.getId()).getSheetByName(Props.getValue(PKeys.SHEET_NAME_MAIN));
    const values = sheet.getRange(13, COLUMN_META.DAY.NO, date.getDate(), COLUMN_META.DIFF.NO).getValues();

    let workDays = 0;
    let diffTotal = 0;
    const rows = [];

    for (const row of values) {
      const type = row[COLUMN_META.TYPE.IDX];
      const dateLabel = DateUtils.formatDate(row[COLUMN_META.DAY.IDX], 'M/d(aaa)');
      const start = getTime(row[COLUMN_META.START.IDX]);
      const end = getTime(row[COLUMN_META.END.IDX]);
      const diff = getTime(row[COLUMN_META.DIFF.IDX]);

      switch (type) {
        case TYPE.WORKING:
          workDays++;
          break;
        case TYPE.DAIKYU:
        case TYPE.HOLIDAY:
        case TYPE.HOLIDAY_WORKING:
        case TYPE.REST:
          break;
        default:
          continue
      }

      let kosu = '';
      if (diff) {
        const mins = convertHour2Minutes(diff);
        diffTotal += mins;
        kosu = convertMinutes2Hour(mins);
      }
      rows.push({
        dateLabel,
        type,
        time: (start && end) ? `${start}-${end}` : '',
        kosu,
        worked: !!diff,
      });
    }

    const totalTime = sheet.getRange(RNG_TTL).getValue();
    return { totalTime, workDays, diffTotal, rows };
  }

  // 過去推移で表示する月数
  const HISTORY_MONTHS = 12;

  /**
   * 指定日が属する月の合計・残業（分）を集計します。ファイルが無ければnull。
   */
  const computeMonthTotals = (date) => {
    const ssFile = getFile(date);
    if (!ssFile) return null;
    const { workDays, diffTotal } = calculateTotalTime(ssFile, date);
    return { total: diffTotal, overtime: diffTotal - workDays * 8 * 60 };
  }

  /**
   * 過去12ヶ月の月別合計・残業を表示します（過去月はキャッシュ）。
   */
  const displayHistory = (replyToken) => {
    const raw = Props.getValue(PKeys.MONTH_SUMMARY_CACHE);
    const cache = raw ? JSON.parse(raw) : {};
    const now = new Date();
    const rows = [];
    let cacheUpdated = false;

    for (let i = 0; i < HISTORY_MONTHS; i++) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const yyyymm = DateUtils.formatDate(monthDate, 'yyyyMM');
      const isCurrent = i === 0;

      let totals;
      if (!isCurrent && cache[yyyymm]) {
        // 確定済みの過去月はキャッシュを使用
        totals = cache[yyyymm];
      } else {
        // 当月は本日まで、過去月は末日まで集計
        const target = isCurrent ? now : new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
        totals = computeMonthTotals(target);
        if (totals && !isCurrent) {
          cache[yyyymm] = totals;
          cacheUpdated = true;
        }
      }

      if (totals) {
        rows.push({
          label: DateUtils.formatDate(monthDate, 'yyyy/MM'),
          total: convertMinutes2Hour(totals.total),
          overtime: convertMinutes2Hour(totals.overtime),
          current: isCurrent,
        });
      }
    }

    if (cacheUpdated) Props.setValue(PKeys.MONTH_SUMMARY_CACHE, JSON.stringify(cache));
    LineManager.replyFlex(replyToken, '過去12ヶ月の推移', FlexCards.history({ title: '過去12ヶ月の推移', rows }));
  }

  /**
   * 期間入力可否を送信します。
   * @param replyToken リプライトークン
   * @param data データ
   * @param mode カレンダーモード
   * @param initial 初期値
   */
  const postPeriodSelect = (replyToken, data, mode, initial = '') => {
    let min = '';
    let max = '';
    switch (mode) {
      case 'time':
        min = '00:00';
        max = '23:59';
        break;
      case 'date':
        min = data.from;
        break;
    }
    const acitons = [];
    acitons.push(LineUtil.makeQuickReply({
      'type': 'datetimepicker',
      'label': 'はい',
      'text': 'はい',
      'data': JSON.stringify(data),
      'mode': mode,
      'initial': initial,
      'min': min,
      'max': max,
    }));
    acitons.push(LineUtil.makeQuickReply({
      'type': 'postback',
      'label': 'いいえ',
      'text': 'いいえ',
      'data': JSON.stringify(data),
    }));
    LineManager.replyQuick(replyToken, '期間入力を行いますか？', acitons);
  }

  /**
   * 勤怠連絡種別選択を通知します。
   * @param replyToken リプライトークン
   * @param data データ
   */
  const postAbsenceTypeSelect = (replyToken, data) => {
    const acitons = [];
    for (const key in ABSENCE_TYPE) {
      data.type = key;
      const label = ABSENCE_TYPE[key].LABEL;
      acitons.push(LineUtil.makeQuickReply({
        'type': 'postback',
        'label': label,
        'text': label,
        'data': JSON.stringify(data),
      }));
    }
    LineManager.replyQuick(replyToken, '連絡種別を教えて下さい。', acitons);
  }

  /**
   * 文字列から勤怠情報を取得します。
   * @param replyToken リプライトークン
   * @param text 文字列
   * @return 勤怠情報
   */
  const getWorkInfo = (replyToken, text) => {
    // 勤怠区分 日付 出社 退社: w 1 1030 20 -> 休日出勤 1日 10:30出社 20:00退社
    // 勤怠区分 日付 退社: w 1 20 -> 休日出勤 1日 20:00退社
    // 日付 退社: 28 2104 -> 28日 21:04退社
    // 出社 退社: 1102 1931 -> 当日 11:02出社 19:31退社
    // 退社: -> 19:20 -> 当日 19:20退社
    // 勤怠区分: -> 有給 -> 有給休暇
    const splitWords = text.split(' ');
    // 勤怠区分取得
    let type = TYPE.WORKING;
    if (splitWords[0].match(/^[r|h|d|w|c]$/)) {
      // 勤怠区分ありの場合
      const typeCd = splitWords.shift();
      type = TYPE[TYPE_CD[typeCd]];
    }
    // 勤怠日時取得
    switch (splitWords.length) {
      case 0:
        return {
          'date': new Date(),
          'type': type,
          'start': '-',
          'end': '-',
        }
      case 1:
        switch (type) {
          case TYPE.WORKING:
          case TYPE.HOLIDAY_WORKING:
            // 出勤の場合は当日勤怠
            return {
              'date': new Date(),
              'type': type,
              'start': '-',
              'end': addZeroPadding(splitWords[0]),
            }
        }
        // 出勤以外の場合は、指定日の勤怠
        return {
          'date': getDate(splitWords[0]),
          'type': type,
        }
      case 2:
        let date = new Date();
        let start = '-';
        const word1 = splitWords[0];
        if (word1.match('[th|日]')) {
          // 先頭が日
          date = getDate(word1);
        } else {
          // 先頭が出社時刻
          start = addZeroPadding(word1);
        }
        return{
          'date': date,
          'type': type,
          'start': start,
          'end': addZeroPadding(splitWords[1]),
        }
      case 3:
        return {
          'date': getDate(splitWords[0]),
          'type': type,
          'start': addZeroPadding(splitWords[1]),
          'end': addZeroPadding(splitWords[2]),
        }
    }
    LineManager.replyFlex(replyToken, '取得失敗', FlexCards.result({ status: 'ng', title: '勤怠情報が取得できませんでした', subtitle: '「使い方」で入力例を確認できます' }));
  }

  /**
   * 日付を取得します。
   * @param 日
   * @return 日付
   */
  const getDate = (day) => {
    day = day.replace('th', '');
    const now = new Date();
    switch (day) {
      case '昨日':
        day = now.getDate() - 1;
        break;
      case '一昨日':
        day = now.getDate() - 2;
        break;
      default:
        day = day.replace('日', '');
        break;
    }
    return new Date(now.getFullYear(), now.getMonth(), day);
  }

  /**
   * 桁数不足の場合に０パディングを行います。
   * @param テキスト
   * @return パディング後の値
   */
  const addZeroPadding = (text) => {
    switch (text.length) {
      case 1:
        // 0x:00の場合
        return '0' + text + '00';
      case 2:
        // 0x:00の場合
        return text + '00';
      case 3:
        // 0x:xxの場合
        return '0' + text;
    }
    return text;
  }

  /**
   * 時刻調整を行います。
   * @param time 時刻（HHmm）
   * @return 調整時刻
   */
  const roundTime = (time) => {
    // 空、未入力の場合は何もしない
    if (!time || '-' === time) return time;
    const match = time.match(/^([\d]{2})[:]*([\d]{2})$/);
    const hour = Number(match[1]);
    const strHour = String(hour).padStart(2, "0");
    const strMinutes = match[2];
    const minutes = Number(strMinutes);
    const roundUnit = Props.getValue(PKeys.ROUND_UNIT);
    if (roundUnit == 0 || minutes === 0) {
      // 調整なし or 00分ジャスト
      return `${strHour}:${strMinutes}`;
    }
    const isRoundUp = roundUnit > 0;
    const absRoundUnit = Math.abs(roundUnit);
    const cnt = Math.trunc(60 / absRoundUnit);
    for (let i = 1; i < cnt; i++) {
      const tmpMinutes = absRoundUnit * i;
      if ((isRoundUp && minutes <= tmpMinutes) || (!isRoundUp && minutes < tmpMinutes)) {
        let roundedMinutes = tmpMinutes;
        if (!isRoundUp) {
          // 切り捨ての場合は一つ前の時間帯
          roundedMinutes -= absRoundUnit;
        }
        return `${strHour}:${String(roundedMinutes).padStart(2, '0')}`;
      }
    }
    if (isRoundUp) {
      return `${String(hour + 1).padStart(2, "0")}:00`;
    }
    return `${strHour}:${String(absRoundUnit * (cnt - 1)).padStart(2, '0')}`;
  }

  /**
   * 勤務時間を更新します。
   * @param replyToken リプライトークン
   * @param date 日付
   * @param type 勤怠区分
   * @param start 出社時間
   * @param end 退社時間
   */
  const updateTime = (replyToken, {date, type, start, end }) => {
    // LINEからの開始登録有無（シート反映前に判定）
    const startProvided = start !== '-';
    // ファイル取得
    const ssFile = getFile(date)
    if (!ssFile) {
      postErrMsgFileNotFound(replyToken, date);
      return;
    }
    const sheet = SpreadsheetApp.openById(ssFile.getId()).getSheetByName(Props.getValue(PKeys.SHEET_NAME_MAIN));
    switch (type) {
      case TYPE.DAIKYU:
      case TYPE.HOLIDAY:
      case TYPE.REST:
        // 休み
        start = '';
        end = '';
        break;
      case TYPE.CLEAR:
        // クリア
        type = '';
        start = '';
        end = '';
        break;
      default:
        // 出社
        if (!DateUtils.isBizDate(date)) {
          // 非営業日の場合は休日出勤に変更
          type = TYPE.HOLIDAY_WORKING;
        }
        // 時刻切り上げ
        start = roundTime(start);
        end = roundTime(end);
        break;
    }
    const rowNo = date.getDate() + 12;
    // 未設定の場合、既存の値で取得する。
    if (start === '-') {
      // 開始時刻を更新しない場合、既存値を取得
      start = getTime(sheet.getRange(rowNo, COLUMN_META.START.NO).getValue());
    }
    const shouldUpdEnd = end !== '-';
    if (!shouldUpdEnd) {
      // 終了時刻を更新しない場合、既存値を取得
      end = getTime(sheet.getRange(rowNo, COLUMN_META.END.NO).getValue());
    }
    if (_testMode) {
      Logger.log(`[TEST] updateTime: row=${rowNo}, type=${type}, start=${start}, end=${end}`);
    } else {
      sheet.getRange(rowNo, COLUMN_META.TYPE.NO).setValue(type);
      sheet.getRange(rowNo, COLUMN_META.START.NO).setValue(start);
      sheet.getRange(rowNo, COLUMN_META.END.NO).setValue(end);
    }
    const diff = getTime(sheet.getRange(rowNo, COLUMN_META.DIFF.NO).getValue());
    const isWorking = (type === TYPE.WORKING || type === TYPE.HOLIDAY_WORKING);
    const cardType = type || TYPE.CLEAR;
    const card = FlexCards.punch({
      dateLabel: DateUtils.formatDate(date, 'M/d(aaa)'),
      type: cardType,
      start: isWorking ? start : '',
      end: (isWorking && shouldUpdEnd) ? end : '',
      kosu: (isWorking && shouldUpdEnd) ? convertMinutes2Hour(convertHour2Minutes(diff)) : '',
      summary: shouldUpdEnd ? getMonthSummaryData(date) : null,
    });
    LineManager.replyFlex(replyToken, `${cardType} 登録`, card);

    // 勤怠開始/終了のLINE登録履歴を記録（連絡漏れ監視で使用）
    if (type === TYPE.WORKING || type === TYPE.HOLIDAY_WORKING) {
      recordPunch(date, { start: startProvided, end: shouldUpdEnd });
    } else if (cardType === TYPE.CLEAR) {
      clearPunch(date);
    }

    // 必要な勤怠連絡のうち未連絡のものがあれば催促（連絡済みは抑止）
    const dateStr = DateUtils.formatDate(date, 'yyyy-MM-dd');
    const needed = neededContactCategories(type, start, end, startProvided, shouldUpdEnd);
    const pending = needed.filter((c) => !isContacted(dateStr, c));
    if (pending.length) {
      executeContactWork('', {
        action: 'absence-mail',
      }, {
        date: dateStr,
      });
    }
  }

  /**
   * 当日の勤怠を登録します。
   * @param replyToken リプライトークン
   * @param data データ
   */
  const executeRegistWorkToday = (replyToken, data) => {
    const workInfo = { 
      'date': new Date(),
      'start': '-',
      'end': '-',
    };
    switch (data.action) {
      case 'start':
      case 'end':
        workInfo.type = TYPE.WORKING;
        workInfo[data.action] = getTime(workInfo.date);
        break;
      case 'break':
        // 欠勤
        workInfo.type = TYPE.REST;
        break;
      default:
        return;
    }
    // 勤務表更新
    updateTime(replyToken, workInfo);
  }

  /**
   * 勤怠をカレンダーにて登録します。
   * @param replyToken リプライトークン
   * @param data データ
   * @param params カレンダーにて指定した値
   */
  const executeRegistCalendar = (replyToken, data, params) => {
    const workInfo = {
      'type': data.type,
      'start': '-',
      'end': '-',
    }
    switch (data.type) {
      case TYPE.REST:
      case TYPE.CLEAR:
        // 欠勤、クリアの場合
        workInfo.date = Utilities.parseDate(params.date, 'JST', "yyyy-MM-dd");
        break;
      case TYPE.WORKING:
        // 出勤の場合
        if (!params) {
          // 期間入力「いいえ」の場合
          workInfo.date = Utilities.parseDate(data.from, 'JST', "yyyy-MM-dd'T'HH:mm");
          workInfo.start = getTime(workInfo.date);
        } else if (params.time) {
          // 日時入力（To入力後）の場合
          workInfo.date = Utilities.parseDate(data.from, 'JST', "yyyy-MM-dd'T'HH:mm");
          workInfo.start = getTime(workInfo.date);
          workInfo.end = params.time;
        } else if (params.datetime) {
          // 日時入力（From入力後）の場合、期間指定確認を行う。
          data.from = params.datetime;
          postPeriodSelect(replyToken, data, 'time', Props.getValue(PKeys.END_TIME_DEFAULT));
          return;
        }
        break;
    }
    // 勤務表更新
    updateTime(replyToken, workInfo);
  }

  /**
   * 翌月勤務表を作成します。
   * @param replyToken リプライトークン
   */
  const makeWorkSchedule = (replyToken) => {
    if (!LockUtil.tryLock(makeWorkSchedule.name)) return;

    try {
      // 当月ファイル検索
      const now = new Date();
      const ssFile = getFile(now);
      if (ssFile && !_testMode) {
        // 当月ファイルリネーム（バックアップ）
        const newFileName = `${Props.getValue(PKeys.FILE_NAME)}_${DateUtils.formatDate(now, 'yyyy年MM月分_yyyyMMddHHmm')}`;
        // ファイル名リネーム
        ssFile.setName(newFileName);
      }

      const nextDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const nextLabel = `${DateUtils.formatDate(nextDate, 'yyyy年 M月')} 勤務表`;
      let result;
      if (Props.hasJsonEntry(PKeys.FILE_MAP, DateUtils.formatDate(nextDate, 'yyyyMM'))) {
        // 作成済み
        result = { status: 'info', title: '翌月分は作成済みです', subtitle: nextLabel };
      } else if (_testMode) {
        // テストモード: ファイル作成をスキップ
        Logger.log('[TEST] makeWorkSchedule: 翌月ファイルの新規作成をスキップ');
        result = { status: 'info', title: '[テスト] 翌月ファイル作成をスキップ', subtitle: nextLabel };
      } else {
        // 翌月ファイルを作成
        copyFile(nextDate);
        result = { status: 'ok', title: '翌月ファイルを作成しました', subtitle: nextLabel };
      }

      LineManager.replyFlex(replyToken, result.title, FlexCards.result(result));
    } finally {
      LockUtil.releaseLock(makeWorkSchedule.name);
    }
  }

  /**
   * 勤務表の提出を行います。
   * @param replyToken リプライトークン
   * @param date 対象日付
   * @return true: 送信成功 / false: 送信失敗
   */
  const executeHandIn = (replyToken, date) => {
    if (!LockUtil.tryLock(executeHandIn.name)) return;

    try {
      // ファイル取得
      const ssFile = getFile(date);
      if (!ssFile) return postErrMsgFileNotFound(replyToken, date);

      // 提出済みチェック
      const yyyyMM = DateUtils.formatDate(date, 'yyyy年MM月');
      const sheetLabel = `${DateUtils.formatDate(date, 'yyyy年 M月')} 勤務表`;
      if (yyyyMM === Props.getValue(PKeys.LAST_SUBMIT_TIMESHEET)) {
        return LineManager.replyFlex(replyToken, '提出済み', FlexCards.result({ status: 'info', title: '提出済みです', subtitle: sheetLabel }));
      }

      // Excelファイル生成
      const blob = buildTimesheetBlob(ssFile, date);
      // メール送信
      const isSuccess = sendTimesheetMail(blob, date);
      if (isSuccess) {
        if (!_testMode) Props.setValue(PKeys.LAST_SUBMIT_TIMESHEET, yyyyMM);
        LineManager.replyFlex(replyToken, '提出しました', FlexCards.result({ status: 'ok', title: '提出しました', subtitle: sheetLabel }));
      } else {
        LineManager.replyFlex(replyToken, '提出に失敗', FlexCards.result({ status: 'ng', title: '提出に失敗しました', subtitle: sheetLabel }));
      }
    } finally {
      LockUtil.releaseLock(executeHandIn.name);
    }
  }

  const buildTimesheetBlob = (ssFile, date) => {
    const url = `https://docs.google.com/spreadsheets/d/${ssFile.getId()}/export?format=xlsx`;
    const options = {
      method: "get",
      headers: {
        "Authorization": `Bearer ${ScriptApp.getOAuthToken()}`
      },
      muteHttpExceptions: true,
    };
    const fileName = `${Props.getValue(PKeys.FILE_NAME)}.xlsx`;
    return UrlFetchApp.fetch(url, options).getBlob().setName(fileName);
  }

  const sendTimesheetMail = (blob, date) => {
    const yyyyMM = DateUtils.formatDate(date, 'yyyyMM');
    const mm = DateUtils.formatDate(date, 'MM');

    const lastName = Props.getValue(PKeys.NAME_LAST);
    const firstName = Props.getValue(PKeys.NAME_FIRST);
    const subject = `【勤怠表提出】${lastName}${firstName}_${yyyyMM}`;
    const body = [
      '各位',
      '',
      `お疲れ様です。${lastName}です。`,
      '',
      `${mm}月分の勤怠表を提出させていただきます。`,
      'また、リモートのため承認印はありません。',
      '',
      '以上、ご査収の程よろしくお願いいたします。',
      '',
      `${lastName}`,
    ].join('\n');

    const toAddresses = _testMode ? [Props.getValue(PKeys.DEBUG_EMAIL)] : JSON.parse(Props.getValue(PKeys.ADDRESS_TO));
    return GoogleApi.sendEmail(toAddresses, subject, body + buildSignature_(), getMailConfig_(), blob);
  };

  /**
   * テキスト形式の勤怠連絡を行います。
   * 入力形式: [休|客先休] yyyymmdd [yyyymmdd] [本文]
   * @param replyToken リプライトークン
   * @param parts 入力テキストをスペース分割した配列
   */
  const sendMailRest = (replyToken, parts) => {
    const typeMap = { '休': 'REST', '客先休': 'WORK_REST' };
    const type = typeMap[parts[0]];
    if (!type) {
      LineManager.replyFlex(replyToken, '連絡種別が不正', FlexCards.result({ status: 'ng', title: '連絡種別が不正です', subtitle: '例) 休 / 客先休' }));
      return;
    }
    const toDateStr = (s) => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
    const from = parts[1] ? toDateStr(parts[1]) : DateUtils.formatDate(new Date(), 'yyyy-MM-dd');
    const hasTo = parts[2] && /^\d{8}$/.test(parts[2]);
    const to = hasTo ? toDateStr(parts[2]) : null;
    const text = parts.slice(hasTo ? 3 : 2).join(' ');
    sendAttendanceNotification(replyToken, { type, from, to, text });
  };

  /**
   * 勤怠連絡を行います。
   * @param replyToken リプライトークン
   * @param data 入力データ（type: 勤怠連絡種別, from: FROM日付, to: TO日付, text: 本文）
   */
  const sendAttendanceNotification = (replyToken, data) => {
    const subjectList = [];
    if (!(data.type in ABSENCE_TYPE)) {
        LineManager.replyFlex(replyToken, 'パラメータ不正', FlexCards.result({ status: 'ng', title: 'パラメータが不正です' }));
        return;
    }
    const absenceType = ABSENCE_TYPE[data.type];
    // 連絡済みチェック（同一日・同一カテゴリの二重連絡を防止）
    const category = CONTACT_CATEGORY_BY_TYPE[data.type];
    const targetDates = buildDateRange(data.from, data.to);
    if (category && targetDates.length && targetDates.every((d) => isContacted(d, category))) {
      const period = data.to ? `${data.from}〜${data.to}` : data.from;
      LineManager.replyFlex(replyToken, `${absenceType.LABEL}連絡`, FlexCards.result({ status: 'info', title: '連絡済みです', subtitle: `${absenceType.LABEL} ・ ${period}` }));
      return;
    }
    // 勤怠連絡種別設定
    subjectList.push(absenceType.SUBJECT);
    // 氏名設定
    subjectList.push(Props.getValue(PKeys.NAME_LAST));
    subjectList.push(Props.getValue(PKeys.NAME_FIRST));
    subjectList.push('_')
    // 開始日取得
    let date = data.from.replace(/-/g, '');
    let body = '';
    if (data.to) {
      // 終了日がある場合、終了日を設定し、本文を再取得
      date += '~' + data.to.replace(/-/g, '');
    }
    if (data.text) {
      // 本文設定
      body = data.text;
    }
    subjectList.push(date)

    // メール送信
    const toAddresses = _testMode ? [Props.getValue(PKeys.DEBUG_EMAIL)] : JSON.parse(Props.getValue(PKeys.ADDRESS_TO_FOR_REST));
    const isSuccess = GoogleApi.sendEmail(toAddresses, subjectList.join(''), body + buildSignature_(), getMailConfig_());
    const period = data.to ? `${data.from}〜${data.to}` : data.from;
    const subtitle = `${absenceType.LABEL} ・ ${period}`;
    if (isSuccess) {
      // 送信履歴を記録（連絡漏れ監視・二重連絡防止で使用）
      if (category) recordContacts(targetDates, category);
      LineManager.replyFlex(replyToken, `${absenceType.LABEL}連絡`, FlexCards.result({ status: 'ok', title: '送信しました', subtitle }));
    } else {
      LineManager.replyFlex(replyToken, `${absenceType.LABEL}連絡`, FlexCards.result({ status: 'ng', title: '送信に失敗しました', subtitle }));
    }
  }

  /**
   * 勤怠連絡を行います。
   * @param replyToken リプライトークン
   * @param data データ
   * @param params カレンダーにて指定した値
   */
  const executeContactWork = (replyToken, data, params) => {
    switch (data.times) {
      case 1:
        // ２回目（勤怠種別選択後）
        data.times = 2;
        if (ABSENCE_TYPE[data.type].USE_PERIOD) {
          // 期間指定あり
          postPeriodSelect(replyToken, data, 'date');
          return
        }
        break;
      case 2:
        // ３回目（To選択後）
        if (params) {
          // To選択後
          data.to = params.date;
        }
        break;
      default:
        // １回目（From選択後）
        data.times = 1;
        data.from = params.date;
        // 勤怠種別選択  
        postAbsenceTypeSelect(replyToken, data);
        return;
    }
    
    // 勤怠連絡
    sendAttendanceNotification(replyToken, data);
  }

  /**
   * ファイル未存在エラーを送信します。
   * @param replyToken リプライトークン
   * @param date 日付
   */
  const postErrMsgFileNotFound = (replyToken, date) => {
    LineManager.replyFlex(replyToken, '勤務表なし', FlexCards.result({ status: 'ng', title: '勤務表がありません', subtitle: `${DateUtils.formatDate(date, 'yyyy年 M月')}分` }));
  }

  /**
   * ファイルコピー
   * @param date 日付
   */
  const copyFile = (date) => {
    // 雛形ファイルコピー
    const templateFile = DriveApp.getFileById(Props.getValue(PKeys.TEMPLATE_FILE_ID));
    const option =  {
      mimeType: MimeType.GOOGLE_SHEETS,                      //Google sheets
      parents: [{id: Props.getValue(PKeys.OUTPUT_DIR_ID)}],  //出力先フォルダー
      title: Props.getValue(PKeys.FILE_NAME),                //出力先ファイル名
    }
    const file = Drive.Files.insert(option,templateFile);

    // ファイル修正
    const ss = SpreadsheetApp.openById(file.id);
    ss.setSpreadsheetTimeZone("Asia/Tokyo");
    ss.setSpreadsheetLocale("ja_JP")
    const sheet = ss.getActiveSheet();
    const nextMonthIndex = date.getMonth();
    const year = date.getFullYear();
    sheet.getRange('A1').setValue(year);
    sheet.getRange('D1').setValue(nextMonthIndex + 1);
    const roundUnit = Props.getValue(PKeys.ROUND_UNIT_CALC);
    sheet.getRange('AL9').setValue(roundUnit); // 開始時刻切上単位
    sheet.getRange('AL10').setValue(roundUnit); // 終了時刻切捨単位

    const startTime = Props.getValue(PKeys.START_TIME_DEFAULT);
    const endTime = Props.getValue(PKeys.END_TIME_DEFAULT);
    for (let i = 1; i <= 31; i++) {
      const targetDate = new Date(year, nextMonthIndex, i);
      const rowNo = 12 + i;
      if (targetDate.getMonth() === nextMonthIndex && DateUtils.isBizDate(targetDate)) {
        // 当月 かつ 営業日の場合はタイムカード時刻設定
        sheet.getRange(rowNo, COLUMN_META.START.NO).setValue(startTime);  // 出社
        sheet.getRange(rowNo, COLUMN_META.END.NO).setValue(endTime);      // 退社
        continue;
      }
      // セルをクリア
      sheet.getRange(rowNo, COLUMN_META.TYPE.NO, 1, 10).clearContent();
    }
    Props.setJsonEntry(PKeys.FILE_MAP, DateUtils.formatDate(new Date(year, nextMonthIndex, 1), 'yyyyMM'), file.id);
  }

  /**
   * ファイル取得
   * @param date 日付
   * @return ファイル
   */
  const getFile = (date) => {
    const fileMap = Props.getJson(PKeys.FILE_MAP)
    const yearMonth = DateUtils.formatDate(date, 'yyyyMM');
    const id = fileMap.get(yearMonth);
    if (id) {
      return DriveApp.getFileById(id);
    }
    return undefined;
  }

  /**
   * 勤怠連絡漏れ・勤怠未登録を監視し、漏れがあればLINEへプッシュ通知します。
   * @param mode 'noon': 開始登録のみで判定 / 'night': 開始・終了の両方で判定
   */
  const checkContactOmissions = (mode) => {
    const now = new Date();
    const ssFile = getFile(now);
    if (!ssFile) return;

    const sheet = SpreadsheetApp.openById(ssFile.getId()).getSheetByName(Props.getValue(PKeys.SHEET_NAME_MAIN));
    const values = sheet.getRange(13, COLUMN_META.DAY.NO, now.getDate(), COLUMN_META.DIFF.NO).getValues();
    const punchLog = getPunchLog();
    const sent = getSentContacts();

    const unregistered = []; // 勤怠未登録（勤怠監視）漏れ
    const absence = [];      // 欠勤連絡漏れ
    const late = [];         // 遅刻連絡漏れ
    const early = [];        // 早退連絡漏れ
    const overWork = [];     // 深夜作業連絡漏れ
    const holidayWork = [];  // 休出連絡漏れ
    const sheetByDate = new Map(); // 逆方向チェック用：日付 → シート状態

    for (const row of values) {
      const dayDate = row[COLUMN_META.DAY.IDX];
      if (!(dayDate instanceof Date) || dayDate.getMonth() !== now.getMonth()) continue;

      const dateStr = DateUtils.formatDate(dayDate, 'yyyy-MM-dd');
      const label = DateUtils.formatDate(dayDate, 'M/d(aaa)');
      const type = row[COLUMN_META.TYPE.IDX];
      const start = getTime(row[COLUMN_META.START.IDX]);
      const end = getTime(row[COLUMN_META.END.IDX]);
      const contacts = sent.get(dateStr) || [];
      sheetByDate.set(dateStr, { type, start, end, label });

      // 欠勤系の日は欠勤連絡のみ判定（他チェックの対象外）
      if (type === TYPE.REST || type === TYPE.HOLIDAY || type === TYPE.DAIKYU) {
        if (!contacts.includes(CONTACT_CATEGORY.ABSENCE)) absence.push(label);
        continue;
      }

      // 休日出勤（非営業日の労働）は休出連絡＋深夜のみ判定
      if (type === TYPE.HOLIDAY_WORKING) {
        if (!contacts.includes(CONTACT_CATEGORY.HOLIDAY_WORK)) holidayWork.push(label);
        if (isOverWorkEnd(end) && !contacts.includes(CONTACT_CATEGORY.OVER_WORK)) overWork.push(label);
        continue;
      }

      // 非営業日かつ休出でない日は対象外
      if (!DateUtils.isBizDate(dayDate)) continue;

      // 遅刻連絡漏れ（出社がデフォルトより遅いが未連絡）
      if (isLateStart(start) && !contacts.includes(CONTACT_CATEGORY.LATE_WORK)) late.push(label);

      // 早退連絡漏れ（退社がデフォルトより早いが未連絡）
      if (isEarlyEnd(end) && !contacts.includes(CONTACT_CATEGORY.EARLY_WORK)) early.push(label);

      // 深夜作業連絡漏れ（退社22時以降だが未連絡）
      if (isOverWorkEnd(end) && !contacts.includes(CONTACT_CATEGORY.OVER_WORK)) overWork.push(label);

      // 勤怠未登録漏れ（LINEでの開始/終了登録で判定）
      const punch = punchLog.get(dateStr) || { start: false, end: false };
      const missing = mode === 'night' ? (!punch.start || !punch.end) : !punch.start;
      if (missing) unregistered.push(label);
    }

    // 逆方向チェック：連絡済みだが勤怠登録がその状態になっていない
    const CAT_LABEL = {
      [CONTACT_CATEGORY.ABSENCE]: '欠勤',
      [CONTACT_CATEGORY.LATE_WORK]: '遅刻',
      [CONTACT_CATEGORY.EARLY_WORK]: '早退',
      [CONTACT_CATEGORY.OVER_WORK]: '深夜',
      [CONTACT_CATEGORY.HOLIDAY_WORK]: '休出',
    };
    const isReflected = (cat, info) => {
      switch (cat) {
        case CONTACT_CATEGORY.ABSENCE:
          return info.type === TYPE.REST || info.type === TYPE.HOLIDAY || info.type === TYPE.DAIKYU;
        case CONTACT_CATEGORY.LATE_WORK:
          return isLateStart(info.start);
        case CONTACT_CATEGORY.EARLY_WORK:
          return isEarlyEnd(info.end);
        case CONTACT_CATEGORY.OVER_WORK:
          return isOverWorkEnd(info.end);
        case CONTACT_CATEGORY.HOLIDAY_WORK:
          return info.type === TYPE.HOLIDAY_WORKING;
        default:
          return true; // 判定対象外は未反映扱いしない
      }
    };
    const unreflected = []; // 連絡済み・勤怠未反映
    for (const [dateStr, info] of sheetByDate) {
      const cats = sent.get(dateStr);
      if (!Array.isArray(cats) || !cats.length) continue;
      const mismatched = cats.filter((c) => CAT_LABEL[c] && !isReflected(c, info));
      if (mismatched.length) {
        unreflected.push(`${info.label}（${mismatched.map((c) => CAT_LABEL[c]).join('/')}）`);
      }
    }

    const sections = [];
    if (unregistered.length) sections.push({ label: '勤怠未登録', dates: unregistered });
    if (absence.length) sections.push({ label: '欠勤連絡漏れ', dates: absence });
    if (late.length) sections.push({ label: '遅刻連絡漏れ', dates: late });
    if (early.length) sections.push({ label: '早退連絡漏れ', dates: early });
    if (overWork.length) sections.push({ label: '深夜作業連絡漏れ', dates: overWork });
    if (holidayWork.length) sections.push({ label: '休出連絡漏れ', dates: holidayWork });
    if (unreflected.length) sections.push({ label: '連絡済み・勤怠未反映', dates: unreflected });
    if (!sections.length) return;

    const title = `勤怠漏れ通知（${mode === 'night' ? '23時' : '12時'}）`;
    if (_testMode) {
      Logger.log(`[TEST] ${title}: ${JSON.stringify(sections)}`);
      return;
    }
    LineManager.replyFlex('', title, FlexCards.omission({ title, sections }));
  }

  return {
    /**
     * ポストバック受信処理を行います。
     */
    handlePostback: (replyToken, receivePostback) => {
      const data = JSON.parse(receivePostback.data);
      switch (data.action) {
        case 'start':
        case 'end':
        case 'break':
          // 当日勤怠登録
          executeRegistWorkToday(replyToken, data);
          break;
        case 'calendar':
          // カレンダー勤怠登録
          executeRegistCalendar(replyToken, data, receivePostback.params);
          break;
        case 'absence-mail':
          // 勤怠連絡
          executeContactWork(replyToken, data, receivePostback.params);
          break;
        case 'list':
          // 稼働表示
          displayAttendanceReport(replyToken, data.month);
          break;
        case 'history':
          // 過去12ヶ月の月別推移
          displayHistory(replyToken);
          break;
        case 'help':
          // ヘルプ表示
          displayHelp(replyToken);
          break;
        case 'handin':
          // 勤務表提出
          executeHandIn(replyToken, new Date());
          // 勤務表作成
          makeWorkSchedule();
          break;
      }
    },
    /**
     * メッセージ受信処理を行います。
     */
    handleMessage: (replyToken, receiveMsg) => {
      switch (receiveMsg.type) {
        case 'sticker':
          // 絵文字
          return;
        case 'text':
          // テキスト
          break;
        default:
          return;
      }
      // 入力テキスト取得
      const text = receiveMsg.text;
      if (text.startsWith('リスト')) {
        // 勤怠一覧表示
        displayAttendanceReport(replyToken, text.replace('リスト', '').trim());
        return;
      }
      if (text.match(/^[休|客先]+/)) {
        // 勤怠連絡
        sendMailRest(replyToken, text.trim().split(' '));
        return;
      }
      const workInfo = getWorkInfo(replyToken, text);
      if (!workInfo) {
        // 勤怠情報取得失敗時
        return;
      }
      updateTime(replyToken, workInfo);
    },
    /**
     * 勤怠連絡漏れ・勤怠未登録を監視します（時間主導トリガーから実行）。
     * @param mode 'noon' | 'night'
     */
    checkContactOmissions: (mode) => checkContactOmissions(mode),
    debug: () => {
      const date = new Date();
      executeContactWork('', {
        action: 'absence-mail',
      }, {
        date: DateUtils.formatDate(date, 'yyyy-MM-dd'),
      });
    },
    enableTestMode: () => { _testMode = true; },
    disableTestMode: () => { _testMode = false; },
  }
})();

/**
 * Lineメッセージ受信ハンドラ
 */
function doPost(e) {
  // 受信データ取得
  const eventData = JSON.parse(e.postData.contents).events[0];
  const replyToken = eventData.replyToken;
  switch (eventData.type) {
    case 'postback':
      MainProc.handlePostback(replyToken, eventData.postback);
      return;
    case 'message':
      MainProc.handleMessage(replyToken, eventData.message);
      break;
  }
}

function debug() {
  MainProc.debug();
}