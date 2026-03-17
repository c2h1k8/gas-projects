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

  /**
   * ヘルプを送信します。
   * @param replyToken リプライトークン
   */
  const displayHelp = (replyToken) => {
    const msg = [];
    const emojis = [];
    emojis.push(LineManager.getBeginnerMark());
    emojis.push(LineManager.getBeginnerMark());
    msg.push('$ ヘルプ $');
    msg.push('日付を指定する場合は末尾にthまたは日を付与してください。');
    msg.push('例）1th 1900 or 1日 1900');
    msg.push('');
    msg.push('勤怠区分を指定するには以下のアルファベットを先頭に付与してください。');
    msg.push('※通常出社の場合は省略')
    msg.push('【勤怠区分】');
    Object.keys(TYPE_CD).forEach(key => {
      msg.push(`- ${key}: ${TYPE[TYPE_CD[key]]}`);
    });
    msg.push('');
    msg.push('勤怠連絡をする場合は、以下の形式でメッセージを送信してください。');
    msg.push('例）[休|客先休] yyyymmdd yyyymmdd 本文');
    LineManager.reply(replyToken, msg, emojis);
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
    const { totalTime, workDays, diffTotal, lines} = calculateTotalTime(ssFile, date);
    const msgs = buildSummaryMessages({ totalTime, workDays, diffTotal, lines, showForecast: diffMonths === '' });;
    LineManager.reply(replyToken, msgs);
  }

  const getMsgTotalTime = (date) => {
    const ssFile = getFile(date);
    const { totalTime, workDays, diffTotal } = calculateTotalTime(ssFile, date);
    // 最終営業日取得
    const lastBizDate = DateUtils.getBizDatePrev(new Date(date.getFullYear(), date.getMonth() + 1, 1), false);
    // 最終営業日ではない場合、見込み時間設定
    const showForecast = date.getDate() < lastBizDate.getDate();
    return buildSummaryMessages({ totalTime, workDays, diffTotal, showForecast });
  }

  const buildSummaryMessages = ({ totalTime, workDays, diffTotal, lines = [], showForecast }) => {
    const msgs = [...lines];
    if (lines.length) msgs.push('----------');

    // 総労働時間設定
    msgs.push(`合計：${convertMinutes2Hour(diffTotal)}`);

    // 見込み時間設定
    if (showForecast) {
      const forecastHour = (totalTime.getDate() + 1) * 24 + totalTime.getHours();
      const forecastMin = DateUtils.formatDate(totalTime, 'mm');
      msgs.push(`見込み：${forecastHour}:${forecastMin}`);
    }

    // 総残業時間設定
    const overtime = diffTotal - workDays * 8 * 60;
    msgs.push(`残業：${convertMinutes2Hour(overtime)}`);
    return msgs;
  };

  const calculateTotalTime = (ssFile, date) => {
    const sheet = SpreadsheetApp.openById(ssFile.getId()).getSheetByName(Props.getValue(PKeys.SHEET_NAME_MAIN));
    const values = sheet.getRange(13, COLUMN_META.DAY.NO, date.getDate(), COLUMN_META.DIFF.NO).getValues();

    let workDays = 0;
    let diffTotal = 0;
    const lines = [];

    for (const row of values) {
      const type = row[COLUMN_META.TYPE.IDX];
      const dateStr = DateUtils.formatDate(row[COLUMN_META.DAY.IDX], 'yyyy-MM-dd(aaa)');
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

      if (diff) {
        const mins = convertHour2Minutes(diff);
        diffTotal += mins;
        lines.push(`${dateStr} ${type} ${start}-${end} (${convertMinutes2Hour(mins)})`)
      } else {
        lines.push(`${dateStr} ${type}`);
      }
    }

    const totalTime = sheet.getRange(RNG_TTL).getValue();
    return { totalTime, workDays, diffTotal, lines};
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
    LineManager.reply(replyToken, '$ 勤怠情報が取得できませんでした。', LineManager.getNgMark());
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
    sheet.getRange(rowNo, COLUMN_META.TYPE.NO).setValue(type);
    sheet.getRange(rowNo, COLUMN_META.START.NO).setValue(start);
    sheet.getRange(rowNo, COLUMN_META.END.NO).setValue(end);
    const diff = getTime(sheet.getRange(rowNo, COLUMN_META.DIFF.NO).getValue());
    const msg = [];
    msg.push(`日付: ${DateUtils.formatDate(date, "yyyy-MM-dd")}`);
    msg.push(`勤怠区分: ${type}`)
    switch (type) {
      case TYPE.WORKING:
      case TYPE.HOLIDAY_WORKING:
        msg.push(`出社: ${start}`);
        if (shouldUpdEnd) {
          msg.push(`退社: ${end}`);
          msg.push(`工数: ${convertMinutes2Hour(convertHour2Minutes(diff))}`);
        }
        break;
    }
    if (shouldUpdEnd) {
      msg.push('----------');
      Array.prototype.push.apply(msg, getMsgTotalTime(date));
    }
    LineManager.reply(replyToken, msg);

    if (shouldAbsenceMail(type, shouldUpdEnd, end)) {
      // 勤怠連絡
      executeContactWork('', {
        action: 'absence-mail',
      }, {
        date: DateUtils.formatDate(date, 'yyyy-MM-dd'),
      });
    }
  }

  const shouldAbsenceMail = (type, shouldUpdEnd, endTime) => {
    if (!shouldUpdEnd) return false;

    switch (type) {
      case TYPE.WORKING:
        break;
      case TYPE.REST:
      case TYPE.HOLIDAY:
      case TYPE.DAIKYU:
      case TYPE.HOLIDAY_WORKING:
        return true;
      case TYPE.CLEAR:
        return false;
    }

    return parseInt(endTime.split(':').map(Number)[0]) >= 22;
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
      if (ssFile) {
        // 当月ファイルリネーム（バックアップ）
        const newFileName = `${Props.getValue(PKeys.FILE_NAME)}_${DateUtils.formatDate(now, 'yyyy年MM月分_yyyyMMddHHmm')}`;
        // ファイル名リネーム
        ssFile.setName(newFileName);
      }

      const nextDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      let msg; 
      let emoji;
      if (Props.hasJsonEntry(PKeys.FILE_MAP, DateUtils.formatDate(nextDate, 'yyyyMM'))) {
        // 作成済み
        msg = ['$ 既に作成済みです。'];
        emoji = LineManager.getNgMark()
      } else {
        // 翌月ファイルを作成
        copyFile(nextDate);
        msg = ['$ 翌月ファイルを作成しました。'];
        emoji = LineManager.getHappinessMark()
      }

      LineManager.reply(replyToken, msg, emoji); 
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
      if (yyyyMM === Props.getValue(PKeys.LAST_SUBMIT_TIMESHEET)) {
        return LineManager.reply(replyToken, `$ ${yyyyMM}分の勤務表は提出済みです。`, LineManager.getNgMark());
      }

      // Excelファイル生成
      const blob = buildTimesheetBlob(ssFile, date);
      // メール送信
      const isSuccess = sendTimesheetMail(blob, date);
      if (isSuccess) {
        Props.setValue(PKeys.LAST_SUBMIT_TIMESHEET, yyyyMM);
        LineManager.reply(replyToken, `$ ${yyyyMM}分の勤務表を提出しました。`, LineManager.getHappinessMark());
      } else {
        LineManager.reply(replyToken, `$ ${yyyyMM}分の勤務表を提出できませんでした。`, LineManager.getAngryMark());
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
    const to = Props.getValue(PKeys.ADDRESS_TO);

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

    return GoogleApi.sendEmail(JSON.parse(to), subject, body + buildSignature_(), getMailConfig_(), blob);
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
      LineManager.reply(replyToken, '$ 連絡種別が不正です。', LineManager.getNgMark());
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
        LineManager.reply(replyToken, '$ パラメータ不正です。', LineManager.getNgMark()); 
        return;
    }
    const absenceType = ABSENCE_TYPE[data.type];
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
    const isSuccess = GoogleApi.sendEmail(JSON.parse(Props.getValue(PKeys.ADDRESS_TO_FOR_REST)), subjectList.join(''), body + buildSignature_(), getMailConfig_());
    if (isSuccess) {
      LineManager.reply(replyToken, `$ ${absenceType.LABEL}連絡を送信しました。`, LineManager.getHappinessMark());
    } else {
      LineManager.reply(replyToken, `$ ${absenceType.LABEL}連絡の送信に失敗しました。`, LineManager.getAngryMark()); 
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
    LineManager.reply(replyToken, `$ ${DateUtils.formatDate(date, 'yyyy年MM月')}分の勤務表がありません。`, LineManager.getAngryMark()); 
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
    debug: () => {
      const date = new Date();
      executeContactWork('', {
        action: 'absence-mail',
      }, {
        date: DateUtils.formatDate(date, 'yyyy-MM-dd'),
      });
    }
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