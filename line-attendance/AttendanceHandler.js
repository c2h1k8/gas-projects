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

  // カテゴリ → 表示ラベル（連絡状況・漏れ通知で共用）
  const CONTACT_CATEGORY_LABEL = {
    [CONTACT_CATEGORY.ABSENCE]: '欠勤',
    [CONTACT_CATEGORY.HOLIDAY_WORK]: '休出',
    [CONTACT_CATEGORY.LATE_WORK]: '遅刻',
    [CONTACT_CATEGORY.EARLY_WORK]: '早退',
    [CONTACT_CATEGORY.OVER_WORK]: '深夜',
  };
  // カテゴリの表示順（連絡状況の並び）
  const CONTACT_CATEGORY_ORDER = [
    CONTACT_CATEGORY.ABSENCE,
    CONTACT_CATEGORY.HOLIDAY_WORK,
    CONTACT_CATEGORY.LATE_WORK,
    CONTACT_CATEGORY.EARLY_WORK,
    CONTACT_CATEGORY.OVER_WORK,
  ];

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
   * Flexメッセージをプッシュ通知します（テストモード時はログ出力のみ）。
   * @param title 通知タイトル（altText）
   * @param contents Flexコンテンツ
   * @param logDetail テストモード時のログ詳細（任意）
   */
  const notifyFlex = (title, contents, logDetail = '') => {
    if (_testMode) {
      Logger.log(`[TEST] ${title}${logDetail ? ': ' + logDetail : ''}`);
      return;
    }
    LineManager.replyFlex('', title, contents);
  };

  /**
   * メール送信先を解決します（テストモード時はデバッグ用アドレス）。
   * @param pkey 送信先アドレスのプロパティキー（JSON配列で保持）
   */
  const resolveRecipients = (pkey) => _testMode
    ? [Props.getValue(PKeys.DEBUG_EMAIL)]
    : JSON.parse(Props.getValue(pkey));

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
   * 前月より前の日付エントリ（'yyyy-MM-dd'キー）を削除します。
   * 月マタギの週（前月末〜当月）は最古の日が前月に入るため、前月分は残す。
   * @return 削除があればtrue
   */
  const pruneOldEntries = (map) => {
    const now = new Date();
    const cutoffYm = DateUtils.formatDate(new Date(now.getFullYear(), now.getMonth() - 1, 1), 'yyyy-MM');
    let removed = false;
    for (const key of map.keys()) {
      if (typeof key === 'string' && key.slice(0, 7) < cutoffYm) {
        map.delete(key);
        removed = true;
      }
    }
    return removed;
  };

  // ===== 勤怠開始/終了のLINE登録履歴（PUNCH_LOG） =====

  const getPunchLog = () => Props.getJson(PKeys.PUNCH_LOG) || new Map();

  /** 休暇系（勤務時間を伴わない区分）か */
  const isLeaveType = (type) => type === TYPE.REST || type === TYPE.HOLIDAY || type === TYPE.DAIKYU;

  /**
   * 勤怠のLINE登録を記録します（連絡漏れ監視・週完了判定で使用）。
   * 稼働/休出は開始/終了をOR合成、休暇系は勤務時間を持たず区分のみ記録します。
   * @param date 対象日
   * @param flags { start: 開始登録あり, end: 終了登録あり, type: 勤怠区分 }
   */
  const recordPunch = (date, { start = false, end = false, type = '' }) => {
    if (_testMode) return;
    const key = DateUtils.formatDate(date, 'yyyy-MM-dd');
    const log = getPunchLog();
    pruneOldEntries(log);
    // 休暇系は勤務時間の概念が無いため、既存の出退勤フラグをリセットして区分のみ保持
    const cur = isLeaveType(type) ? { start: false, end: false } : (log.get(key) || { start: false, end: false });
    cur.start = cur.start || !!start;
    cur.end = cur.end || !!end;
    cur.type = type || cur.type || '';
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
    const { totalTime, workDays, diffTotal, rows, dayCounts } = calculateTotalTime(ssFile, date);
    const summary = summaryData(totalTime, workDays, diffTotal, diffMonths === '');
    // 日数サマリー（稼働は常時表示／その他は0件は非表示。数字を種別色で表示）
    const dayItems = [{ label: '稼働', count: workDays, type: TYPE.WORKING }];
    if (dayCounts.paid) dayItems.push({ label: '有給', count: dayCounts.paid, type: TYPE.HOLIDAY });
    if (dayCounts.holidayWork) dayItems.push({ label: '休出', count: dayCounts.holidayWork, type: TYPE.HOLIDAY_WORKING });
    if (dayCounts.absent) dayItems.push({ label: '欠勤', count: dayCounts.absent, type: TYPE.REST });
    if (dayCounts.daikyu) dayItems.push({ label: '代休', count: dayCounts.daikyu, type: TYPE.DAIKYU });
    const card = FlexCards.list({
      title: `${DateUtils.formatDate(date, 'yyyy年 M月')} 稼働`,
      total: summary.total,
      overtime: summary.overtime,
      forecast: summary.forecast,
      days: dayItems,
      // 工数のある日＋欠勤/有給/代休（休んだ日も俯瞰できるよう表示）
      rows: rows.filter((r) => r.worked || [TYPE.REST, TYPE.HOLIDAY, TYPE.DAIKYU].includes(r.type)),
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

  /**
   * 勤務表ファイルのメインシートを取得します。
   * @param ssFile スプレッドシートファイル
   */
  const getMainSheet = (ssFile) => SpreadsheetApp.openById(ssFile.getId()).getSheetByName(Props.getValue(PKeys.SHEET_NAME_MAIN));

  const calculateTotalTime = (ssFile, date) => {
    const sheet = getMainSheet(ssFile);
    const values = sheet.getRange(13, COLUMN_META.DAY.NO, date.getDate(), COLUMN_META.DIFF.NO).getValues();

    let workDays = 0;
    let diffTotal = 0;
    const rows = [];
    // 区分別の日数（稼働一覧の日数サマリーで使用）
    const dayCounts = { paid: 0, holidayWork: 0, absent: 0, daikyu: 0 };

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
        case TYPE.HOLIDAY:
          dayCounts.paid++;
          break;
        case TYPE.HOLIDAY_WORKING:
          dayCounts.holidayWork++;
          break;
        case TYPE.REST:
          dayCounts.absent++;
          break;
        case TYPE.DAIKYU:
          dayCounts.daikyu++;
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
    return { totalTime, workDays, diffTotal, rows, dayCounts };
  }

  // 過去推移で表示する月数
  const HISTORY_MONTHS = 12;
  // この残業時間（分）を超えた月は推移カードで警告色にする（36協定の目安=45h/月）
  const OVERTIME_ALERT_MIN = 45 * 60;
  // 所定労働時間（分/日）。残業計算と同一基準（8時間）。
  const STD_WORK_MIN = 8 * 60;

  /**
   * 当月ファイル内で from〜to（両端含む）の合計工数・残業（分）を集計します。
   * 工数の集計対象・残業計算は calculateTotalTime と同一基準。ファイルが無ければnull。
   * @param anchorDate 集計対象の月（通常は当日。読み取り行数の基準）
   * @param fromDate 集計開始日（0時）
   * @param toDate 集計終了日（23:59:59）
   */
  const computeRangeTotals = (anchorDate, fromDate, toDate) => {
    const ssFile = getFile(anchorDate);
    if (!ssFile) return null;
    const sheet = getMainSheet(ssFile);
    const values = sheet.getRange(13, COLUMN_META.DAY.NO, anchorDate.getDate(), COLUMN_META.DIFF.NO).getValues();
    let workDays = 0;
    let diffTotal = 0;
    // 区分別の日数（推移カードの休暇バッジ・年間集計で使用）
    const dayCounts = { paid: 0, holidayWork: 0, absent: 0, daikyu: 0 };
    for (const row of values) {
      const dayDate = row[COLUMN_META.DAY.IDX];
      if (!(dayDate instanceof Date)) continue;
      if (dayDate < fromDate || dayDate > toDate) continue;
      switch (row[COLUMN_META.TYPE.IDX]) {
        case TYPE.WORKING:
          workDays++;
          break;
        case TYPE.HOLIDAY:
          dayCounts.paid++;
          break;
        case TYPE.HOLIDAY_WORKING:
          dayCounts.holidayWork++;
          break;
        case TYPE.REST:
          dayCounts.absent++;
          break;
        case TYPE.DAIKYU:
          dayCounts.daikyu++;
          break;
        default:
          continue;
      }
      const diff = getTime(row[COLUMN_META.DIFF.IDX]);
      if (diff) diffTotal += convertHour2Minutes(diff);
    }
    return { total: diffTotal, overtime: diffTotal - workDays * 8 * 60, workDays, dayCounts };
  };

  /**
   * 指定日が属する月の合計・残業（分）を集計します（月初〜指定日）。ファイルが無ければnull。
   */
  const computeMonthTotals = (date) => {
    const from = new Date(date.getFullYear(), date.getMonth(), 1);
    const to = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);
    return computeRangeTotals(date, from, to);
  };

  /**
   * 月別合計/残業キャッシュ（{ yyyyMM: { total, overtime } }）を取得します。
   */
  const getMonthCache = () => {
    const raw = Props.getValue(PKeys.MONTH_SUMMARY_CACHE);
    return raw ? JSON.parse(raw) : {};
  };

  /**
   * 月別合計/残業キャッシュを保存します。
   */
  const setMonthCache = (cache) => Props.setValue(PKeys.MONTH_SUMMARY_CACHE, JSON.stringify(cache));

  /**
   * 過去12ヶ月の月別合計・残業を表示します（過去月はキャッシュ）。
   */
  const displayHistory = (replyToken) => {
    const cache = getMonthCache();
    const now = new Date();
    let cacheUpdated = false;

    // 新しい月→古い月の順で各月の確定値を集める（前月比・年間集計のため一旦配列化）
    const entries = [];
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
      if (totals) entries.push({ monthDate, isCurrent, totals });
    }
    if (cacheUpdated) setMonthCache(cache);

    // バー幅の基準（最繁忙月＝100%）と年間集計
    const maxTotal = entries.reduce((m, e) => Math.max(m, e.totals.total), 0);
    let sumTotal = 0;
    let sumOvertime = 0;
    let sumWorkDays = 0;
    let sumStd = 0; // 所定労働の合計（営業日数×8h）
    let sumPaid = 0;
    let sumAbsent = 0;

    const rows = entries.map((e, idx) => {
      const t = e.totals;
      const dc = t.dayCounts || {};
      // 営業日数＝稼働＋有給＋欠勤＋代休（休日出勤は非営業日のため除外）
      const bizDays = (t.workDays || 0) + (dc.paid || 0) + (dc.absent || 0) + (dc.daikyu || 0);
      sumTotal += t.total;
      sumOvertime += t.overtime;
      sumWorkDays += t.workDays || 0;
      sumStd += bizDays * STD_WORK_MIN;
      sumPaid += dc.paid || 0;
      sumAbsent += dc.absent || 0;

      // 休暇バッジ（区分別日数）
      const days = [];
      if (dc.paid) days.push({ type: TYPE.HOLIDAY, count: dc.paid });
      if (dc.holidayWork) days.push({ type: TYPE.HOLIDAY_WORKING, count: dc.holidayWork });
      if (dc.absent) days.push({ type: TYPE.REST, count: dc.absent });
      if (dc.daikyu) days.push({ type: TYPE.DAIKYU, count: dc.daikyu });

      // 前月比（一つ古い月との差）。バッジの有無に関わらず常に表示。
      let deltaText = null;
      const prev = entries[idx + 1]; // 一つ古い月
      if (prev) {
        const d = t.total - prev.totals.total;
        if (d === 0) deltaText = '±0';
        else deltaText = `${d > 0 ? '↑+' : '↓-'}${convertMinutes2Hour(Math.abs(d))}`;
      }

      return {
        label: DateUtils.formatDate(e.monthDate, 'yyyy/MM'),
        total: convertMinutes2Hour(t.total),
        overtime: convertMinutes2Hour(t.overtime),
        current: e.isCurrent,
        barPct: maxTotal > 0 ? Math.max(t.total > 0 ? 4 : 0, Math.round((t.total / maxTotal) * 100)) : 0,
        days,
        deltaText,
        // 残業が目安を超えた月は警告色（健康管理・36協定）
        alert: t.overtime > OVERTIME_ALERT_MIN,
      };
    });

    // 所定比（年間の実稼働−所定。プラス=超過、マイナス=不足）
    const diffStd = sumTotal - sumStd;
    const stdSign = diffStd === 0 ? '±' : (diffStd > 0 ? '+' : '-');
    const footer = entries.length
      ? {
          yearTotal: convertMinutes2Hour(sumTotal),
          monthAvg: convertMinutes2Hour(Math.round(sumTotal / entries.length)),
          dayAvg: sumWorkDays > 0 ? convertMinutes2Hour(Math.round(sumTotal / sumWorkDays)) : '-',
          overtimeRate: sumTotal > 0 ? `${Math.round((sumOvertime / sumTotal) * 100)}%` : '-',
          overtimeTotal: convertMinutes2Hour(sumOvertime),
          stdDiff: `${stdSign}${convertMinutes2Hour(Math.abs(diffStd))}`,
          paidTotal: `${sumPaid}日`,
          absentTotal: `${sumAbsent}日`,
        }
      : null;

    LineManager.replyFlex(replyToken, '過去12ヶ月の推移', FlexCards.history({ title: '過去12ヶ月の推移', rows, footer }));
  }

  // ===== 稼働サマリー通知（週次 / 月中 / 前月確定） =====

  /**
   * 指定日が属する週の月曜0時を返します。
   */
  const startOfWeekMon = (date) => {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const dow = d.getDay(); // 0=日 .. 6=土
    d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
    return d;
  };

  /**
   * 指定週（月〜金）の週次サマリー表示内容を組み立てます。
   * @param anchorDate 対象週に含まれる任意の日
   * @return { subtitle, metrics, note, signature } / 勤務表が無ければnull
   */
  const buildWeeklySummary_ = (anchorDate) => {
    const from = startOfWeekMon(anchorDate);
    const fri = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 4);
    const to = new Date(fri.getFullYear(), fri.getMonth(), fri.getDate(), 23, 59, 59);
    const week = computeRangeTotals(fri, from, to);
    if (!week) return null;
    const month = getMonthSummaryData(fri);
    const metrics = [
      { label: '今週稼働', value: convertMinutes2Hour(week.total) },
      { label: '今週残業', value: convertMinutes2Hour(week.overtime), accent: true },
      { label: '当月累計', value: month.total },
    ];
    const note = month.forecast
      ? `当月着地見込み ${month.forecast} ／ 残業 ${month.overtime}`
      : `当月残業 ${month.overtime}`;
    const subtitle = `${DateUtils.formatDate(from, 'M/d')}〜${DateUtils.formatDate(fri, 'M/d')}`;
    // 再送要否の判定に使う表示内容のシグネチャ（内容が変われば再送）
    const signature = `${subtitle}|${JSON.stringify(metrics)}|${note}`;
    return { subtitle, metrics, note, signature };
  };

  /**
   * 週次サマリーをLINEへプッシュします。
   * @param data buildWeeklySummary_の戻り値
   */
  const pushWeeklySummary_ = (data) => {
    const title = '週次サマリー';
    notifyFlex(
      title,
      FlexCards.summary({ title, subtitle: data.subtitle, metrics: data.metrics, note: data.note }),
      `${data.subtitle} / ${JSON.stringify(data.metrics)} / ${data.note}`
    );
  };

  /**
   * 指定日が属する週の稼働・残業・当月累計をLINEへプッシュします。
   * @param anchorDate 対象週に含まれる任意の日
   * @return 送信したらtrue（勤務表が無ければ送信せずfalse）
   */
  const sendWeeklySummary = (anchorDate) => {
    const data = buildWeeklySummary_(anchorDate);
    if (!data) return false;
    pushWeeklySummary_(data);
    return true;
  };

  /**
   * 週次サマリーを当日基準でLINEへプッシュします（手動テスト用）。
   */
  const notifyWeeklySummary = () => sendWeeklySummary(new Date());

  // ===== 週完了時の週次サマリー自動送信 =====

  const getWeeklySummarySent = () => Props.getJson(PKeys.WEEKLY_SUMMARY_SENT) || new Map();

  /**
   * 指定日1日分がLINEで登録済みかをPUNCH_LOGで判定します。
   * 勤務表はデフォルト値で埋まっているため、実際のLINE登録有無はプロパティで判断する。
   * 稼働/休日出勤は退勤登録済み（end）が必要、有給/欠勤/代休は区分が入っていれば登録済み。
   * @param dateStr 対象日 'yyyy-MM-dd'
   * @param punchLog PUNCH_LOGのMap
   */
  const isDayRegistered = (dateStr, punchLog) => {
    const punch = punchLog.get(dateStr);
    if (!punch || !punch.type) return false;
    if (punch.type === TYPE.WORKING || punch.type === TYPE.HOLIDAY_WORKING) {
      return !!punch.end; // 退勤登録まで済んで初めて完了
    }
    return true; // 休暇系は区分の登録で完了
  };

  /**
   * 指定週（月〜金）の全営業日がLINEで登録済みかを判定します。
   * 営業日が1日も無い週はfalse（送信対象なし扱い）。
   * @param monday 対象週の月曜0時
   */
  const isWeekFullyRegistered = (monday) => {
    const fri = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 4);
    const punchLog = getPunchLog();
    let hasBizDay = false;
    for (let d = new Date(monday); d <= fri; d.setDate(d.getDate() + 1)) {
      if (!DateUtils.isBizDate(d)) continue; // 非営業日（土日祝）は対象外
      hasBizDay = true;
      if (!isDayRegistered(DateUtils.formatDate(d, 'yyyy-MM-dd'), punchLog)) return false;
    }
    return hasBizDay;
  };

  /**
   * 登録日が属する週（月〜金）の勤怠がすべて登録され切っていれば、
   * 週次サマリーを自動送信します。前回送信と内容が同じ週はスキップし、
   * 修正で内容が変わった場合のみ最新値で再送します。
   * @param date 今回登録した日
   */
  const maybeNotifyWeeklyComplete = (date) => {
    if (_testMode) return;
    const monday = startOfWeekMon(date);
    if (!isWeekFullyRegistered(monday)) return; // まだ埋まっていない
    const data = buildWeeklySummary_(monday);
    if (!data) return;
    const weekKey = DateUtils.formatDate(monday, 'yyyy-MM-dd');
    const sent = getWeeklySummarySent();
    if (sent.get(weekKey) === data.signature) return; // 前回送信と内容が同じならスキップ
    pushWeeklySummary_(data);
    pruneOldEntries(sent);
    sent.set(weekKey, data.signature);
    Props.setJson(PKeys.WEEKLY_SUMMARY_SENT, sent);
  };

  /**
   * 月中サマリー（着地見込み）をLINEへプッシュします（月の中旬想定）。
   * 当月累計・残業・着地見込みを通知。
   */
  const notifyMidMonthSummary = () => {
    const now = new Date();
    if (!getFile(now)) return;
    const month = getMonthSummaryData(now);
    const metrics = [
      { label: '当月累計', value: month.total },
      { label: '残業', value: month.overtime, accent: true },
    ];
    if (month.forecast) metrics.push({ label: '着地見込み', value: month.forecast });
    const title = '月中サマリー';
    const subtitle = `${DateUtils.formatDate(now, 'yyyy年M月')}（${now.getDate()}日時点）`;
    notifyFlex(title, FlexCards.summary({ title, subtitle, metrics }), `${subtitle} / ${JSON.stringify(metrics)}`);
  };

  /**
   * 前月確定サマリーをLINEへプッシュします（月初想定）。
   * 確定した前月の総稼働・残業を通知し、月別キャッシュにも確定値を保存。
   */
  const notifyPrevMonthSummary = () => {
    const now = new Date();
    const prevLast = new Date(now.getFullYear(), now.getMonth(), 0); // 前月末日
    const totals = computeMonthTotals(prevLast);
    if (!totals) return;
    // 確定値を月別キャッシュへ保存（過去推移と整合させる）
    if (!_testMode) {
      const cache = getMonthCache();
      cache[DateUtils.formatDate(prevLast, 'yyyyMM')] = totals;
      setMonthCache(cache);
    }
    const metrics = [
      { label: '総稼働', value: convertMinutes2Hour(totals.total) },
      { label: '残業', value: convertMinutes2Hour(totals.overtime), accent: true },
    ];
    const title = '前月確定サマリー';
    const subtitle = `${DateUtils.formatDate(prevLast, 'yyyy年M月')}分`;
    notifyFlex(title, FlexCards.summary({ title, subtitle, metrics }), `${subtitle} / ${JSON.stringify(metrics)}`);
  };

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
    const sheet = getMainSheet(ssFile);
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

    // 勤怠のLINE登録履歴を記録（連絡漏れ監視・週完了判定で使用）
    if (type === TYPE.WORKING || type === TYPE.HOLIDAY_WORKING) {
      recordPunch(date, { start: startProvided, end: shouldUpdEnd, type });
    } else if (isLeaveType(type)) {
      recordPunch(date, { type });
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

    // その週（月〜金）の勤怠がすべて登録され切ったら、週次サマリーを自動送信（週1回）
    maybeNotifyWeeklyComplete(date);
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

    const toAddresses = resolveRecipients(PKeys.ADDRESS_TO);
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
   * 勤怠連絡メールを送信し、成功時は送信履歴を記録します（返信はしません）。
   * @param type 勤怠連絡種別（ABSENCE_TYPEのKEY）
   * @param from FROM日付（'yyyy-MM-dd'）
   * @param to TO日付（'yyyy-MM-dd' / null）
   * @param text 本文（任意）
   * @return {{ isSuccess, label, period }}
   */
  const performContact_ = (type, from, to, text) => {
    const absenceType = ABSENCE_TYPE[type];
    const category = CONTACT_CATEGORY_BY_TYPE[type];
    const targetDates = buildDateRange(from, to);
    // 件名: 種別 + 氏名 + _ + 日付（範囲は ~ 連結）
    let date = from.replace(/-/g, '');
    if (to) date += '~' + to.replace(/-/g, '');
    const subject = [
      absenceType.SUBJECT,
      Props.getValue(PKeys.NAME_LAST),
      Props.getValue(PKeys.NAME_FIRST),
      '_',
      date,
    ].join('');
    const body = text || '';
    const toAddresses = resolveRecipients(PKeys.ADDRESS_TO_FOR_REST);
    const isSuccess = GoogleApi.sendEmail(toAddresses, subject, body + buildSignature_(), getMailConfig_());
    if (isSuccess && category) {
      // 送信履歴を記録（連絡漏れ監視・二重連絡防止で使用）
      recordContacts(targetDates, category);
    }
    const period = to ? `${from}〜${to}` : from;
    return { isSuccess, label: absenceType.LABEL, period };
  };

  /**
   * 勤怠連絡を行います。
   * @param replyToken リプライトークン
   * @param data 入力データ（type: 勤怠連絡種別, from: FROM日付, to: TO日付, text: 本文）
   */
  const sendAttendanceNotification = (replyToken, data) => {
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
    // メール送信＋履歴記録
    const { isSuccess, label, period } = performContact_(data.type, data.from, data.to, data.text);
    const subtitle = `${label} ・ ${period}`;
    const result = isSuccess
      ? { status: 'ok', title: '送信しました', subtitle }
      : { status: 'ng', title: '送信に失敗しました', subtitle };
    LineManager.replyFlex(replyToken, `${label}連絡`, FlexCards.result(result));
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

  // ===== 連絡状況の照会（連絡したっけ？の確認） =====

  /**
   * 勤務表の1日の状態から必要な連絡カテゴリを返します（checkContactOmissionsと同一基準）。
   * @param type 勤怠区分
   * @param start 出社時刻（'HH:mm' / '-' / ''）
   * @param end 退社時刻（'HH:mm' / '-' / ''）
   * @param dayDate 対象日（営業日判定に使用）
   */
  const neededCategoriesFromSheet_ = (type, start, end, dayDate) => {
    if (isLeaveType(type)) {
      return [CONTACT_CATEGORY.ABSENCE];
    }
    if (type === TYPE.HOLIDAY_WORKING) {
      const cats = [CONTACT_CATEGORY.HOLIDAY_WORK];
      if (isOverWorkEnd(end)) cats.push(CONTACT_CATEGORY.OVER_WORK);
      return cats;
    }
    if (!DateUtils.isBizDate(dayDate)) return [];
    const cats = [];
    if (isLateStart(start)) cats.push(CONTACT_CATEGORY.LATE_WORK);
    if (isEarlyEnd(end)) cats.push(CONTACT_CATEGORY.EARLY_WORK);
    if (isOverWorkEnd(end)) cats.push(CONTACT_CATEGORY.OVER_WORK);
    return cats;
  };

  /**
   * 当月の連絡状況を (日付×カテゴリ) で収集します。
   * 勤務表の状態（要連絡）と連絡履歴（連絡済み・未来日含む）を合成。
   * @return [{ dateStr, label, cat, catLabel, sent, pending }]（日付昇順・カテゴリ表示順）
   */
  const collectContactStatus_ = () => {
    const now = new Date();
    const curYm = DateUtils.formatDate(now, 'yyyy-MM');
    const sent = getSentContacts();

    // 勤務表（当日まで）から「要連絡」カテゴリを収集
    const neededMap = new Map(); // dateStr -> Set(category)
    const ssFile = getFile(now);
    if (ssFile) {
      const sheet = getMainSheet(ssFile);
      const values = sheet.getRange(13, COLUMN_META.DAY.NO, now.getDate(), COLUMN_META.DIFF.NO).getValues();
      for (const row of values) {
        const dayDate = row[COLUMN_META.DAY.IDX];
        if (!(dayDate instanceof Date) || dayDate.getMonth() !== now.getMonth()) continue;
        const cats = neededCategoriesFromSheet_(
          row[COLUMN_META.TYPE.IDX],
          getTime(row[COLUMN_META.START.IDX]),
          getTime(row[COLUMN_META.END.IDX]),
          dayDate,
        );
        if (cats.length) neededMap.set(DateUtils.formatDate(dayDate, 'yyyy-MM-dd'), new Set(cats));
      }
    }

    // 要連絡日 ∪ 連絡済み日（当月分。連絡履歴は未来日も保持しているため拾える）
    const dateSet = new Set(neededMap.keys());
    for (const key of sent.keys()) {
      if (typeof key === 'string' && key.slice(0, 7) === curYm) dateSet.add(key);
    }

    const entries = [];
    for (const dateStr of [...dateSet].sort()) {
      const needed = neededMap.get(dateStr) || new Set();
      const sentCats = new Set(sent.get(dateStr) || []);
      const label = DateUtils.formatDate(Utilities.parseDate(dateStr, 'JST', 'yyyy-MM-dd'), 'M/d(aaa)');
      for (const cat of CONTACT_CATEGORY_ORDER) {
        const isSent = sentCats.has(cat);
        const isNeeded = needed.has(cat);
        if (!isSent && !isNeeded) continue;
        entries.push({
          dateStr,
          label,
          cat,
          catLabel: CONTACT_CATEGORY_LABEL[cat] || cat,
          sent: isSent,
          pending: isNeeded && !isSent,
        });
      }
    }
    return entries;
  };

  /**
   * 'yyyy-MM-dd'の昇順配列を連続する区間に分割します。
   * @return [{ from, to }]（単日は to=null）
   */
  const groupConsecutiveDates_ = (sortedDateStrs) => {
    const groups = [];
    for (const ds of sortedDateStrs) {
      const last = groups[groups.length - 1];
      if (last) {
        const next = new Date(last.toDate);
        next.setDate(next.getDate() + 1);
        if (DateUtils.formatDate(next, 'yyyy-MM-dd') === ds) {
          last.toDate = Utilities.parseDate(ds, 'JST', 'yyyy-MM-dd');
          last.to = ds;
          continue;
        }
      }
      groups.push({ from: ds, to: ds, toDate: Utilities.parseDate(ds, 'JST', 'yyyy-MM-dd') });
    }
    return groups.map((g) => ({ from: g.from, to: g.from === g.to ? null : g.to }));
  };

  /**
   * 当月の連絡状況カードを表示します（✅連絡済 / ⚠️要連絡＋連絡ボタン）。
   * @param replyToken リプライトークン
   */
  const displayContactStatus = (replyToken) => {
    const now = new Date();
    const entries = collectContactStatus_();
    const pendingCount = entries.filter((e) => e.pending).length;
    LineManager.replyFlex(replyToken, '連絡状況', FlexCards.contactStatus({
      title: '連絡状況',
      subtitle: DateUtils.formatDate(now, 'yyyy年M月'),
      entries,
      pendingCount,
    }));
  };

  /**
   * 連絡状況から「連絡する」を実行します（日付プリセット）。
   * @param replyToken リプライトークン
   * @param data { date, cat, type? }
   */
  const executeContactNow = (replyToken, data) => {
    if (data.cat === CONTACT_CATEGORY.ABSENCE) {
      if (!data.type) {
        // 欠勤系は通常休/客先休を選ばせる
        const actions = ['REST', 'WORK_REST'].map((key) => LineUtil.makeQuickReply({
          type: 'postback',
          label: ABSENCE_TYPE[key].LABEL,
          text: ABSENCE_TYPE[key].LABEL,
          data: JSON.stringify({ action: 'contact-now', date: data.date, cat: data.cat, type: key }),
        }));
        LineManager.replyQuick(replyToken, '連絡種別を教えて下さい。', actions);
        return;
      }
      sendAttendanceNotification(replyToken, { type: data.type, from: data.date, to: null, text: '' });
      return;
    }
    // 遅刻/早退/深夜/休出はカテゴリ＝ABSENCE_TYPEのKEYなので種別確定済み
    sendAttendanceNotification(replyToken, { type: data.cat, from: data.date, to: null, text: '' });
  };

  /**
   * 未連絡をまとめて連絡します（欠勤系は連続日を期間レンジで一括送信）。
   * @param replyToken リプライトークン
   * @param data { type? }（欠勤系がある場合は通常休/客先休のKEY）
   */
  const executeContactBulk = (replyToken, data) => {
    const pendings = collectContactStatus_().filter((e) => e.pending);
    if (!pendings.length) {
      LineManager.replyFlex(replyToken, 'まとめて連絡', FlexCards.result({ status: 'info', title: '未連絡はありません' }));
      return;
    }
    const hasAbsence = pendings.some((e) => e.cat === CONTACT_CATEGORY.ABSENCE);
    if (hasAbsence && !data.type) {
      // 欠勤系を含む場合は通常休/客先休を一度だけ選ばせる
      const actions = ['REST', 'WORK_REST'].map((key) => LineUtil.makeQuickReply({
        type: 'postback',
        label: ABSENCE_TYPE[key].LABEL,
        text: ABSENCE_TYPE[key].LABEL,
        data: JSON.stringify({ action: 'contact-bulk', type: key }),
      }));
      LineManager.replyQuick(replyToken, '欠勤の連絡種別を教えて下さい。', actions);
      return;
    }

    const results = [];
    // 欠勤系: 連続日を期間レンジでまとめて送信
    const absenceDates = pendings.filter((e) => e.cat === CONTACT_CATEGORY.ABSENCE).map((e) => e.dateStr).sort();
    for (const range of groupConsecutiveDates_(absenceDates)) {
      results.push(performContact_(data.type, range.from, range.to, ''));
    }
    // 遅刻/早退/深夜/休出: 単日イベントなので1日ずつ送信
    for (const e of pendings) {
      if (e.cat === CONTACT_CATEGORY.ABSENCE) continue;
      results.push(performContact_(e.cat, e.dateStr, null, ''));
    }

    const sentCount = results.filter((r) => r.isSuccess).length;
    const failedCount = results.length - sentCount;
    const result = failedCount
      ? { status: 'ng', title: '一部送信に失敗しました', subtitle: `送信 ${sentCount}件 / 失敗 ${failedCount}件` }
      : { status: 'ok', title: 'まとめて連絡しました', subtitle: `送信 ${sentCount}件` };
    LineManager.replyFlex(replyToken, 'まとめて連絡', FlexCards.result(result));
  };

  // ===== 状況確認（オンデマンド） =====

  /**
   * 当月勤務表の提出状況を表示します（提出済み/未提出＋最終営業日カウントダウン）。
   * @param replyToken リプライトークン
   */
  const displaySubmitStatus = (replyToken) => {
    const now = new Date();
    const yyyyMM = DateUtils.formatDate(now, 'yyyy年MM月');
    const submitted = Props.getValue(PKeys.LAST_SUBMIT_TIMESHEET) === yyyyMM;
    const lastBizDate = DateUtils.getBizDatePrev(new Date(now.getFullYear(), now.getMonth() + 1, 1), false);
    // 本日〜最終営業日の残り営業日数（本日含む）
    let remaining = 0;
    for (let d = new Date(now.getFullYear(), now.getMonth(), now.getDate()); d <= lastBizDate; d.setDate(d.getDate() + 1)) {
      if (DateUtils.isBizDate(d)) remaining++;
    }
    const subtitle = `${DateUtils.formatDate(now, 'yyyy年M月')}分\n最終営業日 ${DateUtils.formatDate(lastBizDate, 'M/d(aaa)')}（あと${remaining}営業日）`;
    const result = submitted
      ? { status: 'ok', title: '提出済みです', subtitle }
      : { status: remaining <= 1 ? 'ng' : 'info', title: '未提出です', subtitle };
    LineManager.replyFlex(replyToken, '提出状況', FlexCards.result(result));
  };

  /**
   * 当月の着地見込み（累計・残業・着地見込み）を表示します。
   * @param replyToken リプライトークン
   */
  const displayMonthForecast = (replyToken) => {
    const now = new Date();
    if (!getFile(now)) {
      postErrMsgFileNotFound(replyToken, now);
      return;
    }
    const month = getMonthSummaryData(now);
    const metrics = [
      { label: '当月累計', value: month.total },
      { label: '残業', value: month.overtime, accent: true },
    ];
    if (month.forecast) metrics.push({ label: '着地見込み', value: month.forecast });
    const subtitle = `${DateUtils.formatDate(now, 'yyyy年M月')}（${now.getDate()}日時点）`;
    LineManager.replyFlex(replyToken, '着地見込み', FlexCards.summary({ title: '着地見込み', subtitle, metrics }));
  };

  /**
   * 当月勤務表のスプレッドシートを開くリンクを表示します。
   * @param replyToken リプライトークン
   */
  const displayWorkbookLink = (replyToken) => {
    const now = new Date();
    const ssFile = getFile(now);
    if (!ssFile) {
      postErrMsgFileNotFound(replyToken, now);
      return;
    }
    LineManager.replyFlex(replyToken, '勤務表を開く', FlexCards.link({
      title: '勤務表を開く',
      subtitle: `${DateUtils.formatDate(now, 'yyyy年M月')}分の勤務表`,
      url: ssFile.getUrl(),
      label: 'スプレッドシートを開く',
    }));
  };

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
   * 勤怠連絡漏れ・勤怠未登録を監視します。
   * replyToken指定時はオンデマンド点検として返信（漏れなしも返信）、未指定時はプッシュ通知。
   * @param mode 'noon': 開始登録のみで判定 / 'night': 開始・終了の両方で判定
   * @param replyToken リプライトークン（オンデマンド点検時のみ）
   */
  const checkContactOmissions = (mode, replyToken = '') => {
    const now = new Date();
    const ssFile = getFile(now);
    if (!ssFile) {
      if (replyToken) postErrMsgFileNotFound(replyToken, now);
      return;
    }

    const sheet = getMainSheet(ssFile);
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
      if (isLeaveType(type)) {
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
          return isLeaveType(info.type);
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

    // 勤務表未提出チェック（23時のみ・最終営業日に未提出なら通知）
    let timesheetUnsubmitted = false;
    if (mode === 'night') {
      const lastBizDate = DateUtils.getBizDatePrev(new Date(now.getFullYear(), now.getMonth() + 1, 1), false);
      const isLastBizDay = now.getDate() === lastBizDate.getDate();
      const yyyyMM = DateUtils.formatDate(now, 'yyyy年MM月');
      timesheetUnsubmitted = isLastBizDay && Props.getValue(PKeys.LAST_SUBMIT_TIMESHEET) !== yyyyMM;
    }

    const sections = [];
    if (timesheetUnsubmitted) sections.push({ label: '勤務表未提出', dates: [`${DateUtils.formatDate(now, 'yyyy年M月')}分（最終営業日）`] });
    if (unregistered.length) sections.push({ label: '勤怠未登録', dates: unregistered });
    if (absence.length) sections.push({ label: '欠勤連絡漏れ', dates: absence });
    if (late.length) sections.push({ label: '遅刻連絡漏れ', dates: late });
    if (early.length) sections.push({ label: '早退連絡漏れ', dates: early });
    if (overWork.length) sections.push({ label: '深夜作業連絡漏れ', dates: overWork });
    if (holidayWork.length) sections.push({ label: '休出連絡漏れ', dates: holidayWork });
    if (unreflected.length) sections.push({ label: '連絡済み・勤怠未反映', dates: unreflected });

    // オンデマンド点検: 漏れなしも返信し、漏れありはその場で返信
    if (replyToken) {
      if (!sections.length) {
        LineManager.replyFlex(replyToken, '勤怠チェック', FlexCards.result({ status: 'ok', title: '抜け漏れはありません', subtitle: `${DateUtils.formatDate(now, 'yyyy年M月')} 時点` }));
        return;
      }
      const title = '勤怠チェック';
      LineManager.replyFlex(replyToken, title, FlexCards.omission({ title, sections }));
      return;
    }

    if (!sections.length) return;
    const title = `勤怠漏れ通知（${mode === 'night' ? '23時' : '12時'}）`;
    notifyFlex(title, FlexCards.omission({ title, sections }), JSON.stringify(sections));
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
        case 'contact-status':
          // 連絡状況の照会
          displayContactStatus(replyToken);
          break;
        case 'contact-now':
          // 連絡状況からそのまま連絡
          executeContactNow(replyToken, data);
          break;
        case 'contact-bulk':
          // 未連絡をまとめて連絡
          executeContactBulk(replyToken, data);
          break;
        case 'contact-check':
          // 勤怠チェック（オンデマンド点検）
          checkContactOmissions('noon', replyToken);
          break;
        case 'submit-status':
          // 提出状況
          displaySubmitStatus(replyToken);
          break;
        case 'forecast':
          // 当月の着地見込み
          displayMonthForecast(replyToken);
          break;
        case 'workbook':
          // 勤務表を開く
          displayWorkbookLink(replyToken);
          break;
        case 'make-schedule':
          // 翌月勤務表の作成
          makeWorkSchedule(replyToken);
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
    /**
     * 週次サマリーを当日基準で通知します（手動テスト用。自動送信は登録完了時に発火）。
     */
    notifyWeeklySummary: () => notifyWeeklySummary(),
    /**
     * 月中サマリーを通知します（時間主導トリガーから実行）。
     */
    notifyMidMonthSummary: () => notifyMidMonthSummary(),
    /**
     * 前月確定サマリーを通知します（時間主導トリガーから実行）。
     */
    notifyPrevMonthSummary: () => notifyPrevMonthSummary(),
    enableTestMode: () => { _testMode = true; },
    disableTestMode: () => { _testMode = false; },
  }
})();