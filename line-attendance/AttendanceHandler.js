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
   * 勤務表の送信先を解決します（テストモード時はデバッグ用アドレス）。
   */
  const resolveRecipients = () => _testMode
    ? [Props.getValue(PKeys.DEBUG_EMAIL)]
    : JSON.parse(Props.getValue(PKeys.ADDRESS_TO));

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
    // 残業が所定に満たない場合はマイナスになるため、符号を分けてから桁を整える
    const sign = minutes < 0 ? '-' : '';
    const abs = Math.abs(minutes);
    return `${sign}${Math.trunc(abs / 60)}:${String(abs % 60).padStart(2, "0")}`;
  }

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

  // ===== 休暇の予約（勤務表が未作成の月） =====

  const getReservations = () => Props.getJson(PKeys.LEAVE_RESERVATIONS) || new Map();

  const setReservations = (map) => Props.setJson(PKeys.LEAVE_RESERVATIONS, map);

  /**
   * 勤務表が無くても予約として受け付けられるかを判定します。
   * 出勤は時刻の丸めも工数もシートの数式に依存するため対象外。休暇系は区分だけで完結する。
   * @param date 対象日
   * @param type 勤怠区分（updateTimeの加工前の値）
   */
  const canReserveLeave_ = (date, type) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date > today && (isLeaveType(type) || type === TYPE.CLEAR);
  };

  /**
   * 勤務表が未作成の月の休暇を予約として保存します。
   * クリアは予約の取り消しとして扱う。
   * @return 常にnull（シートには未反映のため打刻としては未確定）
   */
  const reserveLeave_ = (replyToken, date, type) => {
    const key = DateUtils.formatDate(date, 'yyyy-MM-dd');
    const dateLabel = DateUtils.formatDate(date, 'M/d(aaa)');
    const reservations = getReservations();

    if (type === TYPE.CLEAR) {
      if (!reservations.delete(key)) {
        LineManager.replyFlex(replyToken, '予約なし', FlexCards.result({
          status: 'info', title: '予約はありません', subtitle: dateLabel,
        }));
        return null;
      }
      if (!_testMode) setReservations(reservations);
      // 予約していた有給は消化を戻す
      recordPaidLeave_('', date);
      LineManager.replyFlex(replyToken, '予約を取り消しました', FlexCards.result({
        status: 'ok', title: '予約を取り消しました', subtitle: dateLabel,
      }));
      return null;
    }

    reservations.set(key, type);
    pruneOldEntries(reservations);
    if (!_testMode) setReservations(reservations);
    // 予約の時点で有休を引き当てる（勤務表への反映時に二重に数えないよう日付で管理）
    const paidNote = buildPaidLeaveNote_(type, date, recordPaidLeave_(type, date));
    LineManager.replyFlex(replyToken, '予約しました', FlexCards.result({
      status: 'ok',
      title: `${type} を予約しました`,
      subtitle: [
        dateLabel,
        `${DateUtils.formatDate(date, 'yyyy年M月')}の勤務表を作成したときに反映されます`,
        paidNote,
      ].filter(Boolean).join('\n'),
    }));
    return null;
  };

  /**
   * 予約済みの休暇を、新規作成した勤務表へ反映します。
   * 反映した分は予約から取り除き、PUNCH_LOGへ登録済みとして記録する（未登録チェック・週完了判定と整合させる）。
   * @param sheet 作成した勤務表のシート
   * @param year 対象年
   * @param monthIndex 対象月（0始まり）
   * @return 反映件数
   */
  const applyReservations_ = (sheet, year, monthIndex) => {
    const reservations = getReservations();
    if (!reservations.size) return 0;
    const prefix = DateUtils.formatDate(new Date(year, monthIndex, 1), 'yyyy-MM');
    let applied = 0;
    for (const [key, type] of [...reservations]) {
      if (typeof key !== 'string' || key.slice(0, 7) !== prefix) continue;
      const day = Number(key.slice(8, 10));
      // 月末を超えるキーは行がずれるため無視（通常は発生しない）
      if (new Date(year, monthIndex, day).getMonth() !== monthIndex) continue;
      const rowNo = day + 12;
      sheet.getRange(rowNo, COLUMN_META.TYPE.NO).setValue(type);
      sheet.getRange(rowNo, COLUMN_META.START.NO).setValue('');
      sheet.getRange(rowNo, COLUMN_META.END.NO).setValue('');
      recordPunch(new Date(year, monthIndex, day), { type });
      reservations.delete(key);
      applied++;
    }
    if (applied) setReservations(reservations);
    return applied;
  };

  /**
   * 予約中の休暇一覧を表示します（月ごとに見出しを付け、日付単位で取消できる）。
   * @param replyToken リプライトークン
   * @param note 直前の操作結果（任意）
   */
  const displayReservations = (replyToken, note = '') => {
    const reservations = getReservations();
    if (pruneOldEntries(reservations)) setReservations(reservations);
    const entries = [...reservations.keys()].sort().map((dateStr) => {
      const date = Utilities.parseDate(dateStr, 'JST', 'yyyy-MM-dd');
      return {
        dateStr,
        monthLabel: DateUtils.formatDate(date, 'yyyy年M月'),
        label: DateUtils.formatDate(date, 'M/d(aaa)'),
        type: reservations.get(dateStr),
      };
    });
    const title = '休暇の予約';
    const ledger = loadPaidLeaveLedger_();
    LineManager.replyFlex(replyToken, title, FlexCards.reservations({
      title,
      note,
      entries,
      balance: ledger ? paidLeaveText_(ledger, ymdKey_(new Date())) : '',
      addLeave: true,
    }));
  };

  /**
   * 一覧からの予約取り消しです。
   * @param data { date: 'yyyy-MM-dd' }
   */
  const executeCancelReservation = (replyToken, data) => {
    const reservations = getReservations();
    const type = reservations.get(data.date);
    if (!reservations.delete(data.date)) {
      displayReservations(replyToken, '対象の予約は既にありません');
      return;
    }
    setReservations(reservations);
    // 予約していた有給は消化を戻す
    recordPaidLeave_('', Utilities.parseDate(data.date, 'JST', 'yyyy-MM-dd'));
    const label = DateUtils.formatDate(Utilities.parseDate(data.date, 'JST', 'yyyy-MM-dd'), 'M/d(aaa)');
    displayReservations(replyToken, `${label} の${type}を取り消しました`);
  };

  // ===== 提出済み月の編集ロック =====

  /**
   * 対象日の月が提出済みかを判定します。
   * LAST_SUBMIT_TIMESHEETは 'yyyy年MM月'（月はゼロ埋め）のため、文字列比較で新旧を比べられる。
   * 提出済み月とそれより古い月をまとめて対象にする。
   * @param date 対象日
   */
  const isSubmittedMonth = (date) => {
    const last = Props.getValue(PKeys.LAST_SUBMIT_TIMESHEET);
    return !!last && DateUtils.formatDate(date, 'yyyy年MM月') <= last;
  };

  /**
   * 提出済み月なら編集不可のカードを返します。
   * @param replyToken リプライトークン
   * @param date 対象日
   * @return ロックしたらtrue（呼び出し側は処理を中断する）
   */
  const replySubmittedLock_ = (replyToken, date) => {
    if (!isSubmittedMonth(date)) return false;
    LineManager.replyFlex(replyToken, '提出済み', FlexCards.result({
      status: 'ng',
      title: '提出済みのため登録できません',
      subtitle: `${DateUtils.formatDate(date, 'yyyy年M月')}分は提出済みです`,
    }));
    return true;
  };

  // ===== 有給休暇の付与・残日数 =====

  // 継続勤務月数→付与日数（プロパティ未設定時の既定＝労基法の法定日数）
  const PAID_LEAVE_TABLE_DEFAULT = [
    { months: 6, days: 10 },
    { months: 18, days: 11 },
    { months: 30, days: 12 },
    { months: 42, days: 14 },
    { months: 54, days: 16 },
    { months: 66, days: 18 },
    { months: 78, days: 20 },
  ];
  // 付与の有効期間（年）。プロパティ未設定時の既定＝時効2年
  const PAID_LEAVE_EXPIRE_YEARS_DEFAULT = 2;
  // 消化の引き当て順。'newest'=今期分から / 'oldest'=繰越分から
  const PAID_LEAVE_USE_ORDER_DEFAULT = 'newest';
  // 台帳に残す失効済みの付与の期間（年）。これより古い付与と消化履歴は捨てる
  const PAID_LEAVE_KEEP_YEARS = 1;

  const ymdKey_ = (date) => DateUtils.formatDate(date, 'yyyy-MM-dd');

  /**
   * 月数を加算します。応当日が無い月は月末に丸めます（例: 8/31の6ヶ月後は2月末）。
   */
  const addMonths_ = (date, months) => {
    const moved = new Date(date.getFullYear(), date.getMonth() + months, date.getDate());
    // 日が繰り上がっていたら応当日の無い月なので、前月の末日へ戻す
    if (moved.getDate() !== date.getDate()) moved.setDate(0);
    return moved;
  };

  /**
   * 有休管理の設定を返します。
   * @return { join, table: [{months, days}]（月数の昇順）, expireYears, useOrder } / 入社日が未設定ならnull
   */
  const getPaidLeaveConfig_ = () => {
    const join = Props.getValue(PKeys.PAID_LEAVE_JOIN_DATE);
    // 入社日が無ければ有休管理をしない運用（休暇はすべて欠勤で登録）
    if (!join) return null;
    const table = Props.getJson(PKeys.PAID_LEAVE_TABLE) || PAID_LEAVE_TABLE_DEFAULT;
    if (!Array.isArray(table) || !table.length) return null;
    return {
      join: Utilities.parseDate(join, 'JST', 'yyyy-MM-dd'),
      table: [...table].sort((a, b) => a.months - b.months),
      expireYears: Number(Props.getValue(PKeys.PAID_LEAVE_EXPIRE_YEARS)) || PAID_LEAVE_EXPIRE_YEARS_DEFAULT,
      useOrder: Props.getValue(PKeys.PAID_LEAVE_USE_ORDER) || PAID_LEAVE_USE_ORDER_DEFAULT,
    };
  };

  /**
   * 入社日からの付与予定を組み立てます。
   * 初回は表の最小月数（法定は6ヶ月）、以降は1年ごとに付与し、
   * 表の最終行を超えた勤続は最終行の日数が続きます。
   * @param config 有休設定
   * @param through この日までに付与されるものを対象にする
   * @return [{ date, days, expire }]（'yyyy-MM-dd'・付与日の昇順）
   */
  const paidLeaveSchedule_ = (config, through) => {
    const schedule = [];
    for (let months = config.table[0].months; ; months += 12) {
      const date = addMonths_(config.join, months);
      if (date > through) break;
      const row = config.table.filter((r) => r.months <= months).pop();
      schedule.push({
        date: ymdKey_(date),
        days: row.days,
        // 失効日（この日から使えない）＝付与日のNヶ年後。最終利用日はその前日。
        expire: ymdKey_(addMonths_(date, config.expireYears * 12)),
      });
    }
    return schedule;
  };

  // ----- 有休台帳（プロパティで保持し、登録のたびに更新する） -----

  const emptyLedger_ = () => ({ grants: [], used: {} });

  const savePaidLeaveLedger_ = (ledger) => {
    if (_testMode) return;
    Props.setJson(PKeys.PAID_LEAVE_LEDGER, ledger);
  };

  /**
   * 台帳を読み込み、未登録の付与の追加・古い付与の整理まで済ませて返します。
   * 新しい期の付与はここで追加されるため、台帳に触れる操作（打刻・休暇登録・予約）が
   * そのまま付与のきっかけになります（時間主導トリガーは不要）。
   * 消化実績は勤務表から追えないので、台帳が無い場合は消化なしから始めます
   * （導入時の実績はプロパティへ直接書いて用意する）。
   * @param through この日までの付与を用意する（未来日の登録にも対応するため）
   * @return 台帳 / 有休管理が未設定ならnull
   */
  const loadPaidLeaveLedger_ = (through = new Date()) => {
    const config = getPaidLeaveConfig_();
    if (!config) return null;
    const stored = Props.getJson(PKeys.PAID_LEAVE_LEDGER);
    const ledger = (stored && Array.isArray(stored.grants)) ? stored : emptyLedger_();
    if (syncPaidLeaveGrants_(ledger, config, through)) savePaidLeaveLedger_(ledger);
    return ledger;
  };

  /**
   * 付与予定を台帳へ反映し、古くなった付与と消化履歴を整理します。
   * @return 台帳を変更したらtrue
   */
  const syncPaidLeaveGrants_ = (ledger, config, through) => {
    let changed = false;
    for (const s of paidLeaveSchedule_(config, through)) {
      const grant = ledger.grants.find((g) => g.date === s.date);
      if (!grant) {
        ledger.grants.push({ date: s.date, days: s.days, expire: s.expire, used: 0 });
        changed = true;
      } else if (grant.days !== s.days || grant.expire !== s.expire) {
        // 付与テーブルや時効の設定を変えたときは、消化実績を残したまま条件だけ追従させる
        grant.days = s.days;
        grant.expire = s.expire;
        changed = true;
      }
    }
    ledger.grants.sort((a, b) => (a.date < b.date ? -1 : 1));

    // 失効から一定期間を過ぎた付与と、それに紐づく消化履歴は捨てる
    const cutoff = ymdKey_(addMonths_(new Date(), -12 * PAID_LEAVE_KEEP_YEARS));
    const dropped = ledger.grants.filter((g) => g.expire < cutoff).map((g) => g.date);
    if (dropped.length) {
      ledger.grants = ledger.grants.filter((g) => g.expire >= cutoff);
      for (const key of Object.keys(ledger.used)) {
        if (dropped.includes(ledger.used[key])) delete ledger.used[key];
      }
      changed = true;
    }
    return changed;
  };

  /**
   * 指定日に有効な付与を返します（付与日以後・失効前）。
   */
  const validGrants_ = (ledger, key) => ledger.grants.filter((g) => g.date <= key && key < g.expire);

  /**
   * 指定日時点の有休残を返します。
   */
  const paidLeaveRemain_ = (ledger, key) => validGrants_(ledger, key)
    .reduce((sum, g) => sum + (g.days - g.used), 0);

  /**
   * 1日分の消化を付与へ引き当てます（設定に応じて今期分／繰越分から使う）。
   * 同じ日を二重に引き当てないよう、登録済みの日は何もしません。
   * @return 引き当てできればtrue
   */
  const applyPaidLeaveUse_ = (ledger, key, useOrder) => {
    if (ledger.used[key]) return true;
    const usable = validGrants_(ledger, key).filter((g) => g.used < g.days);
    if (!usable.length) return false;
    // 付与日の昇順に並んでいるため、今期分＝末尾／繰越分＝先頭
    const grant = useOrder === 'oldest' ? usable[0] : usable[usable.length - 1];
    grant.used++;
    ledger.used[key] = grant.date;
    return true;
  };

  /**
   * 引き当て済みの消化を取り消します（有給以外への変更・クリア・予約取消で使用）。
   * @return 取り消したらtrue
   */
  const releasePaidLeaveUse_ = (ledger, key) => {
    const grantDate = ledger.used[key];
    if (!grantDate) return false;
    const grant = ledger.grants.find((g) => g.date === grantDate);
    if (grant && grant.used > 0) grant.used--;
    delete ledger.used[key];
    return true;
  };

  // ----- 登録・表示 -----

  /**
   * 有休台帳に今回の登録を反映します（有給なら消化、それ以外の区分なら消化を戻す）。
   * @param type 登録した勤怠区分（クリアは空文字）
   * @param date 対象日
   * @return 反映後の台帳 / 有休管理が未設定ならnull
   */
  const recordPaidLeave_ = (type, date) => {
    const config = getPaidLeaveConfig_();
    if (!config) return null;
    const ledger = loadPaidLeaveLedger_(date);
    const key = ymdKey_(date);
    const changed = type === TYPE.HOLIDAY
      ? applyPaidLeaveUse_(ledger, key, config.useOrder)
      : releasePaidLeaveUse_(ledger, key);
    if (changed) savePaidLeaveLedger_(ledger);
    return ledger;
  };

  /**
   * 有休残の表示文言を組み立てます。
   * @param ledger 台帳
   * @param key 基準日 'yyyy-MM-dd'
   */
  const paidLeaveText_ = (ledger, key) => {
    const remain = paidLeaveRemain_(ledger, key);
    if (remain <= 0) return '有休 残 0日';
    // 次に失効する分（残っている有効な付与のうち、失効が最も早いもの）
    const next = validGrants_(ledger, key)
      .filter((g) => g.used < g.days)
      .sort((a, b) => (a.expire < b.expire ? -1 : 1))[0];
    if (!next) return `有休 残 ${remain}日`;
    const until = Utilities.parseDate(next.expire, 'JST', 'yyyy-MM-dd');
    until.setDate(until.getDate() - 1);
    return `有休 残 ${remain}日（${DateUtils.formatDate(until, 'yyyy/M/d')}までに ${next.days - next.used}日）`;
  };

  /**
   * 休暇を登録します。有給が残っていれば有給休暇、残っていなければ欠勤で登録します。
   * @param replyToken リプライトークン
   * @param date 対象日
   */
  const executeRegistLeave = (replyToken, date) => {
    // 区分を決める前に、登録できない日はここで弾く
    if (replySubmittedLock_(replyToken, date)) return;
    const ledger = loadPaidLeaveLedger_(date);
    const key = ymdKey_(date);
    // 既に有給として引き当て済みの日は、押し直しても有給のまま
    const canPaid = !!ledger && (!!ledger.used[key] || paidLeaveRemain_(ledger, key) > 0);
    updateTime(replyToken, { date, type: canPaid ? TYPE.HOLIDAY : TYPE.REST, start: '-', end: '-' });
  };

  /**
   * 打刻カードに添える有休残の文言を組み立てます。
   * @param type 登録した勤怠区分
   * @param date 対象日
   * @param ledger 反映後の台帳（null可）
   * @return 表示文言（有休管理をしない設定ならnull）
   */
  const buildPaidLeaveNote_ = (type, date, ledger) => {
    if (!ledger) return null;
    if (type !== TYPE.HOLIDAY && type !== TYPE.REST) return null;
    const key = ymdKey_(date);
    if (type === TYPE.REST && paidLeaveRemain_(ledger, key) <= 0) return '有休の残がないため欠勤です';
    return paidLeaveText_(ledger, key);
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
    // 勤務表取得
    const sheet = getMainSheet(date);
    if (!sheet) {
      postErrMsgFileNotFound(replyToken, date);
      return;
    }
    const { totalTime, workDays, diffTotal, rows, dayCounts } = calculateTotalTime(sheet, date);
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
   * 月サマリーの集計範囲と表示要素を決めます。
   * 合計・残業は実績なので、対象日が未来でも「今日」で打ち切る（未来行は勤務表に既定値が
   * 入っており稼働として数えてしまうため）。見込みはシート側の月合計セル（未来行の予定込み）
   * が元なので、実績がまだ無い未来月でも意味を持つ。
   * @param date 対象日
   * @return {{ through, showTotals, showForecast }} through=集計打ち切り日（未来月はnull）
   */
  const monthSummaryScope_ = (date) => {
    const now = new Date();
    const ym = DateUtils.formatDate(date, 'yyyyMM');
    const nowYm = DateUtils.formatDate(now, 'yyyyMM');
    if (ym > nowYm) {
      // 未来月：実績が1件も無いので合計・残業は出さず、予定ベースの見込みだけ出す
      return { through: null, showTotals: false, showForecast: true };
    }
    if (ym < nowYm) {
      // 過去月：末日で確定しているため見込みは出さない
      const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      return { through: lastDay, showTotals: true, showForecast: false };
    }
    // 当月：今日で打ち切る。最終営業日以降は見込みを出さない
    const lastBizDate = DateUtils.getBizDatePrev(new Date(now.getFullYear(), now.getMonth() + 1, 1), false);
    return { through: now, showTotals: true, showForecast: now.getDate() < lastBizDate.getDate() };
  };

  /**
   * 指定日の月の集計データ（文字列）を返します。
   * 集計範囲はmonthSummaryScope_に従い、対象日ではなく今日を基準に打ち切る。
   * @return {{ total, overtime, forecast }} いずれもnull可
   */
  const getMonthSummaryData = (date) => {
    const sheet = getMainSheet(date);
    const { through, showTotals, showForecast } = monthSummaryScope_(date);
    if (!showTotals) {
      // 未来月は行を読まず、シートの月合計セル（予定込み）から見込みだけ組み立てる
      return summaryData(sheet.getRange(RNG_TTL).getValue(), 0, null, showForecast);
    }
    const { totalTime, workDays, diffTotal } = calculateTotalTime(sheet, through);
    return summaryData(totalTime, workDays, diffTotal, showForecast);
  }

  /**
   * サマリーの表示文字列を組み立てます。
   * @param diffTotal 実績の合計（分）。nullなら合計・残業を出さない（未来月）
   */
  const summaryData = (totalTime, workDays, diffTotal, showForecast) => {
    let forecast = null;
    if (showForecast) {
      const forecastHour = (totalTime.getDate() + 1) * 24 + totalTime.getHours();
      const forecastMin = DateUtils.formatDate(totalTime, 'mm');
      forecast = `${forecastHour}:${forecastMin}`;
    }
    if (diffTotal === null) return { total: null, overtime: null, forecast };
    const overtime = diffTotal - workDays * 8 * 60;
    return {
      total: convertMinutes2Hour(diffTotal),
      overtime: convertMinutes2Hour(overtime),
      forecast,
    };
  };

  /**
   * 勤務表のメインシートを取得します（IDから直接開くためDrive APIを経由しない）。
   * @param date 日付
   * @return シート / 勤務表が無ければnull
   */
  const getMainSheet = (date) => {
    const id = getFileId(date);
    if (!id) return null;
    return SpreadsheetApp.openById(id).getSheetByName(Props.getValue(PKeys.SHEET_NAME_MAIN));
  };

  /**
   * 月初〜打ち切り日の実績を集計します。
   * @param sheet メインシート
   * @param through 集計の打ち切り日。日付部分だけを見るため、未来日を渡すと未来行（既定で稼働）
   *   まで数えてしまう。呼び出し側で今日または過去月の末日に丸めること。
   */
  const calculateTotalTime = (sheet, through) => {
    const values = sheet.getRange(13, COLUMN_META.DAY.NO, through.getDate(), COLUMN_META.DIFF.NO).getValues();

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
    const sheet = getMainSheet(anchorDate);
    if (!sheet) return null;
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
   * fromDateの翌日からtoDateまでの営業日数を数えます。
   * @param fromDate 起点（この日は含まない）
   * @param toDate 終点（この日を含む）
   */
  const countBizDaysAfter_ = (fromDate, toDate) => {
    let count = 0;
    const d = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate() + 1);
    for (; d <= toDate; d.setDate(d.getDate() + 1)) {
      if (DateUtils.isBizDate(d)) count++;
    }
    return count;
  };

  /**
   * 指定週（月〜金）の週次サマリー表示内容を組み立てます。
   * @param anchorDate 対象週に含まれる任意の日
   * @param throughDate 集計の打ち切り日（週の途中で参照する場合に指定）。
   *   未来日は勤務表に既定値が入っており稼働として数えてしまうため、当日までに絞る。
   * @return { subtitle, metrics, note, signature } / 勤務表が無ければnull
   */
  const buildWeeklySummary_ = (anchorDate, throughDate = null) => {
    const from = startOfWeekMon(anchorDate);
    const fri = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 4);
    const last = (throughDate && throughDate < fri) ? throughDate : fri;
    const to = new Date(last.getFullYear(), last.getMonth(), last.getDate(), 23, 59, 59);
    const week = computeRangeTotals(last, from, to);
    if (!week) return null;
    const month = getMonthSummaryData(last);
    // メトリクスは今週の指標で揃え、当月の値は注記に回す（横並びは3つまでが収まりの上限）
    const metrics = [
      { label: '今週稼働', value: convertMinutes2Hour(week.total) },
      { label: '今週残業', value: convertMinutes2Hour(week.overtime), accent: true },
    ];
    // 残りの営業日を所定労働で埋めた場合の週の着地見込み（週が終わっていれば出さない）
    const remainingBizDays = countBizDaysAfter_(last, fri);
    if (remainingBizDays > 0) {
      metrics.push({
        label: '今週見込み',
        value: convertMinutes2Hour(week.total + remainingBizDays * STD_WORK_MIN),
      });
    }
    // 未来月は実績が無く合計・残業がnullになるため、出せる項目だけ並べる
    const noteParts = [];
    if (month.total) noteParts.push(`当月 ${month.total}`);
    if (month.forecast) noteParts.push(`着地見込み ${month.forecast}`);
    if (month.overtime) noteParts.push(`残業 ${month.overtime}`);
    const note = noteParts.join(' ／ ');
    const subtitle = `${DateUtils.formatDate(from, 'M/d')}〜${DateUtils.formatDate(last, 'M/d')}`;
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

  /**
   * 今週の稼働・残業・当月累計を表示します（メニューからのオンデマンド）。
   * 週の途中でも見られるよう、集計は当日までで打ち切る。
   * @param replyToken リプライトークン
   */
  const displayWeeklySummary = (replyToken) => {
    const now = new Date();
    const data = buildWeeklySummary_(now, now);
    if (!data) {
      postErrMsgFileNotFound(replyToken, now);
      return;
    }
    const title = '今週の状況';
    LineManager.replyFlex(replyToken, title, FlexCards.summary({
      title,
      subtitle: data.subtitle,
      metrics: data.metrics,
      note: data.note,
    }));
  };

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
    if (!getFileId(now)) return;
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
   * @param reply 打刻カードを返信するか（呼び出し側で別のカードを返す場合はfalse）
   * @return { kosu, punchCard } 更新成功（kosuは退社確定時のみ／punchCardは{ altText, contents }）
   *         ／中断・予約として受け付けた場合はnull
   */
  const updateTime = (replyToken, {date, type, start, end }, { reply = true } = {}) => {
    // 提出済み月は編集不可（全ての登録経路がここを通る）
    if (replySubmittedLock_(replyToken, date)) return null;
    // LINEからの開始登録有無（シート反映前に判定）
    const startProvided = start !== '-';
    // 勤務表取得
    const sheet = getMainSheet(date);
    if (!sheet) {
      // 未来の休暇は勤務表が無くても予約として受け付ける（勤務表の作成時に反映）
      if (canReserveLeave_(date, type)) return reserveLeave_(replyToken, date, type);
      postErrMsgFileNotFound(replyToken, date);
      return null;
    }
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
    const shouldUpdEnd = end !== '-';
    // 更新しない時刻は既存値を引き継ぐ。出社〜退社の列は連続しているため1回の読み取りで済ませる。
    if (start === '-' || !shouldUpdEnd) {
      const width = COLUMN_META.END.NO - COLUMN_META.START.NO + 1;
      const cols = sheet.getRange(rowNo, COLUMN_META.START.NO, 1, width).getValues()[0];
      if (start === '-') start = getTime(cols[0]);
      if (!shouldUpdEnd) end = getTime(cols[width - 1]);
    }
    if (_testMode) {
      Logger.log(`[TEST] updateTime: row=${rowNo}, type=${type}, start=${start}, end=${end}`);
    } else {
      sheet.getRange(rowNo, COLUMN_META.TYPE.NO).setValue(type);
      sheet.getRange(rowNo, COLUMN_META.START.NO).setValue(start);
      sheet.getRange(rowNo, COLUMN_META.END.NO).setValue(end);
    }
    // 有休台帳へ反映（有給なら消化、他の区分・クリアなら消化を戻す）
    const ledger = recordPaidLeave_(type, date);
    const cardType = type || TYPE.CLEAR;
    const isWorking = (type === TYPE.WORKING || type === TYPE.HOLIDAY_WORKING);
    // 退社まで入った稼働日のみ工数が確定する
    const kosu = (isWorking && shouldUpdEnd)
      ? convertMinutes2Hour(convertHour2Minutes(getTime(sheet.getRange(rowNo, COLUMN_META.DIFF.NO).getValue())))
      : '';
    // 打刻カードは常に組み立てる（reply=falseの呼び出し元は自前のカードと並べて返すため）
    const punchCard = {
      altText: `${cardType} 登録`,
      contents: FlexCards.punch({
        dateLabel: DateUtils.formatDate(date, 'M/d(aaa)'),
        type: cardType,
        start: isWorking ? start : '',
        end: (isWorking && shouldUpdEnd) ? end : '',
        kosu,
        summary: shouldUpdEnd ? getMonthSummaryData(date) : null,
        // 有給・欠勤は登録後の有休残を添える
        note: buildPaidLeaveNote_(type, date, ledger),
      }),
    };
    if (reply) {
      LineManager.replyFlex(replyToken, punchCard.altText, punchCard.contents);
    }

    // 勤怠のLINE登録履歴を記録（連絡漏れ監視・週完了判定で使用）
    if (type === TYPE.WORKING || type === TYPE.HOLIDAY_WORKING) {
      recordPunch(date, { start: startProvided, end: shouldUpdEnd, type });
    } else if (isLeaveType(type)) {
      recordPunch(date, { type });
    } else if (cardType === TYPE.CLEAR) {
      clearPunch(date);
    }

    // その週（月〜金）の勤怠がすべて登録され切ったら、週次サマリーを自動送信（週1回）
    maybeNotifyWeeklyComplete(date);
    return { kosu, punchCard };
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
    if (!params || !params.date) return;
    if (data.type === TYPE.WORKING) {
      // 出勤は日付確定後、その日の出社/退社を個別に入力するカードを返す
      // （日付が決まってから時刻を聞くため、既存の時刻を入力の初期値にできる）
      displayDayPunch(replyToken, params.date);
      return;
    }
    if (isLeaveType(data.type)) {
      // 休暇は区分を自動判定する（区分を持つ古いリッチメニューからのポストバックもここで受ける）
      executeRegistLeave(replyToken, Utilities.parseDate(params.date, 'JST', 'yyyy-MM-dd'));
      return;
    }
    // クリアは区分のみなのでそのまま更新
    updateTime(replyToken, {
      type: data.type,
      date: Utilities.parseDate(params.date, 'JST', 'yyyy-MM-dd'),
      start: '-',
      end: '-',
    });
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
        // 翌月ファイルを作成（予約していた休暇があれば反映される）
        const applied = copyFile(nextDate);
        result = {
          status: 'ok',
          title: '翌月ファイルを作成しました',
          subtitle: applied ? `${nextLabel}\n予約していた休暇 ${applied}件を反映しました` : nextLabel,
        };
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

    const toAddresses = resolveRecipients();
    return GoogleApi.sendEmail(toAddresses, subject, body + buildSignature_(), getMailConfig_(), blob);
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
    if (!getFileId(now)) {
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
    // 勤務表が無い状態で登録された休暇の予約を反映（既定値を書いたあとに上書きする）
    const applied = applyReservations_(sheet, year, nextMonthIndex);
    Props.setJsonEntry(PKeys.FILE_MAP, DateUtils.formatDate(new Date(year, nextMonthIndex, 1), 'yyyyMM'), file.id);
    return applied;
  }

  /**
   * 勤務表ファイルのIDを取得します（Drive APIを呼ばない軽量版）。
   * @param date 日付
   * @return ファイルID / 未作成ならundefined
   */
  const getFileId = (date) => {
    const fileMap = Props.getJson(PKeys.FILE_MAP);
    if (!fileMap) return undefined;
    return fileMap.get(DateUtils.formatDate(date, 'yyyyMM'));
  }

  /**
   * ファイル取得（リネーム・URL取得などファイル操作が必要な場合のみ使用）。
   * @param date 日付
   * @return ファイル
   */
  const getFile = (date) => {
    const id = getFileId(date);
    return id ? DriveApp.getFileById(id) : undefined;
  }

  // ===== 未登録の勤怠（一覧・後追い登録） =====

  /** 'H:mm' の設定値を 'HH:mm' に揃えます（datetimepickerのinitialは2桁固定）。 */
  const padTime = (time) => /^\d:/.test(time) ? `0${time}` : time;

  /**
   * 時刻入力カード1行分のエントリを組み立てます。
   * 時刻は入力の初期値に使うため、登録済みならその時刻、未登録なら勤務表の既定値を採る。
   * @param dayDate 対象日
   * @param row 勤務表の該当行
   * @param punch PUNCH_LOGの該当エントリ
   */
  const buildPunchEntry_ = (dayDate, row, punch) => ({
    dateStr: DateUtils.formatDate(dayDate, 'yyyy-MM-dd'),
    label: DateUtils.formatDate(dayDate, 'M/d(aaa)'),
    start: getTime(row[COLUMN_META.START.IDX]) || padTime(Props.getValue(PKeys.START_TIME_DEFAULT)),
    end: getTime(row[COLUMN_META.END.IDX]) || padTime(Props.getValue(PKeys.END_TIME_DEFAULT)),
    needStart: !punch.start,
    needEnd: !punch.end,
  });

  /**
   * 当月（1日〜当日）の未登録日を収集します。未来日は対象外。
   * 勤務表は営業日に既定値が入っているため、登録有無はPUNCH_LOGで判断する。
   * 休暇系・休日出勤は勤怠区分の登録で完了しているため対象外。
   * @return [{ dateStr, label, start, end, needStart, needEnd }]（日付昇順）/ 勤務表が無ければnull
   */
  const collectUnregistered_ = () => {
    const now = new Date();
    const sheet = getMainSheet(now);
    if (!sheet) return null;
    const values = sheet.getRange(13, COLUMN_META.DAY.NO, now.getDate(), COLUMN_META.DIFF.NO).getValues();
    const punchLog = getPunchLog();

    const entries = [];
    for (const row of values) {
      const dayDate = row[COLUMN_META.DAY.IDX];
      if (!(dayDate instanceof Date) || dayDate.getMonth() !== now.getMonth()) continue;

      const type = row[COLUMN_META.TYPE.IDX];
      if (isLeaveType(type) || type === TYPE.HOLIDAY_WORKING) continue;
      if (!DateUtils.isBizDate(dayDate)) continue;

      const punch = punchLog.get(DateUtils.formatDate(dayDate, 'yyyy-MM-dd')) || { start: false, end: false };
      if (punch.start && punch.end) continue;

      entries.push(buildPunchEntry_(dayDate, row, punch));
    }
    return entries;
  };

  /**
   * 指定日1日分の時刻入力カードを組み立てます。
   * @param replyToken リプライトークン（表示できない場合の理由返信に使用）
   * @param dateStr 対象日 'yyyy-MM-dd'
   * @return { altText, contents } / 表示できない場合はnull（理由は返信済み）
   */
  const buildDayPunchCard_ = (replyToken, dateStr) => {
    const date = Utilities.parseDate(dateStr, 'JST', 'yyyy-MM-dd');
    if (replySubmittedLock_(replyToken, date)) return null;
    const sheet = getMainSheet(date);
    if (!sheet) {
      postErrMsgFileNotFound(replyToken, date);
      return null;
    }
    const row = sheet.getRange(date.getDate() + 12, COLUMN_META.DAY.NO, 1, COLUMN_META.DIFF.NO).getValues()[0];
    const punch = getPunchLog().get(dateStr) || { start: false, end: false };
    const entry = buildPunchEntry_(date, row, punch);
    const title = `${entry.label} の勤怠`;
    return {
      altText: title,
      contents: FlexCards.unregistered({ title, entries: [entry], single: true }),
    };
  };

  /**
   * 未登録一覧カードを組み立てます。
   * @param entries 未登録エントリ（1件以上）
   * @return { altText, contents }
   */
  const buildUnregisteredCard_ = (entries) => ({
    altText: '未登録の勤怠',
    contents: FlexCards.unregistered({
      title: '未登録の勤怠',
      subtitle: `${DateUtils.formatDate(new Date(), 'yyyy年M月')} ・ 残り ${entries.length}件`,
      entries,
    }),
  });

  /**
   * 指定日1日分の時刻入力カードを表示します（カレンダー登録の出勤で使用）。
   * @param replyToken リプライトークン
   * @param dateStr 対象日 'yyyy-MM-dd'
   */
  const displayDayPunch = (replyToken, dateStr) => {
    const card = buildDayPunchCard_(replyToken, dateStr);
    if (card) LineManager.replyFlex(replyToken, card.altText, card.contents);
  };

  /**
   * 当月の未登録一覧を表示します（出社/退社を個別に入力できるカード）。
   * @param replyToken リプライトークン
   */
  const displayUnregistered = (replyToken) => {
    const now = new Date();
    const entries = collectUnregistered_();
    if (entries === null) {
      postErrMsgFileNotFound(replyToken, now);
      return;
    }
    if (!entries.length) {
      LineManager.replyFlex(replyToken, '未登録の勤怠', FlexCards.result({
        status: 'ok',
        title: '未登録はありません',
        subtitle: `${DateUtils.formatDate(now, 'yyyy年M月')} 時点`,
      }));
      return;
    }
    const card = buildUnregisteredCard_(entries);
    LineManager.replyFlex(replyToken, card.altText, card.contents);
  };

  /**
   * 未登録一覧から出社/退社の時刻を登録します。
   * 選んだ側だけを更新し、もう一方は現状を維持します。
   * 返信は通常登録と同じ打刻カードを先頭に置き、続けて入力できるよう呼び出し元のカードを添えます。
   * @param replyToken リプライトークン
   * @param data { date: 'yyyy-MM-dd', field: 'start' | 'end', single: 1日カードから呼ばれたか }
   * @param params 時刻選択の結果（{ time: 'HH:mm' }）
   */
  const executeFillPunch = (replyToken, data, params) => {
    if (!params || !params.time) return;
    const date = Utilities.parseDate(data.date, 'JST', 'yyyy-MM-dd');
    const isStart = data.field === 'start';
    const updated = updateTime(replyToken, {
      date,
      type: TYPE.WORKING,
      start: isStart ? params.time : '-',
      end: isStart ? '-' : params.time,
    }, { reply: false });
    // 中断時はupdateTimeが理由を返信済み
    if (!updated) return;

    // 1日カードは時刻の修正にも使うため常に添える。
    // 一覧は残りが無くなったら省略し、打刻カードだけで完結させる。
    let followUp = null;
    if (data.single) {
      followUp = buildDayPunchCard_(replyToken, data.date);
    } else {
      const entries = collectUnregistered_();
      if (entries && entries.length) followUp = buildUnregisteredCard_(entries);
    }
    LineManager.replyFlexMulti(replyToken, [updated.punchCard, followUp]);
  };

  /**
   * 勤怠未登録・勤務表未提出を監視し、漏れがあればプッシュ通知します。
   * オンデマンドの確認はメニューの「未登録」（その場で入力もできる）が担う。
   * @param mode 'noon': 開始登録のみで判定 / 'night': 開始・終了の両方で判定
   */
  const checkAttendanceOmissions = (mode) => {
    const now = new Date();
    const entries = collectUnregistered_();
    if (entries === null) return;

    // 12時は開始登録のみ、23時は開始・終了の両方で未登録を判定
    const unregistered = entries
      .filter((e) => mode === 'night' || e.needStart)
      .map((e) => e.label);

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
          // 当日勤怠登録
          executeRegistWorkToday(replyToken, data);
          break;
        case 'break':
          // 当日の休暇（有休の残に応じて有給/欠勤を自動判定）
          executeRegistLeave(replyToken, new Date());
          break;
        case 'leave-calendar':
          // カレンダーで日付を選んだ休暇（区分は自動判定）
          if (receivePostback.params && receivePostback.params.date) {
            executeRegistLeave(replyToken, Utilities.parseDate(receivePostback.params.date, 'JST', 'yyyy-MM-dd'));
          }
          break;
        case 'calendar':
          // カレンダー勤怠登録
          executeRegistCalendar(replyToken, data, receivePostback.params);
          break;
        case 'unregistered':
          // 未登録一覧
          displayUnregistered(replyToken);
          break;
        case 'fill-punch':
          // 未登録一覧からの出社/退社の時刻入力
          executeFillPunch(replyToken, data, receivePostback.params);
          break;
        case 'weekly':
          // 今週の状況
          displayWeeklySummary(replyToken);
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
        case 'reservations':
          // 休暇の予約一覧
          displayReservations(replyToken);
          break;
        case 'cancel-reservation':
          // 一覧からの予約取り消し
          executeCancelReservation(replyToken, data);
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
      const workInfo = getWorkInfo(replyToken, text);
      if (!workInfo) {
        // 勤怠情報取得失敗時
        return;
      }
      updateTime(replyToken, workInfo);
    },
    /**
     * 勤怠未登録・勤務表未提出を監視します（時間主導トリガーから実行）。
     * @param mode 'noon' | 'night'
     */
    checkAttendanceOmissions: (mode) => checkAttendanceOmissions(mode),
    /**
     * 有休台帳（付与履歴・消化・残日数）を返します（確認・テスト用）。
     * @return { grants: [{ date, days, expire, used }], used: { 'yyyy-MM-dd': 付与日 } } / 未設定ならnull
     */
    getPaidLeaveLedger: (date = new Date()) => loadPaidLeaveLedger_(date),
    /**
     * 指定日時点の有休残を返します。
     */
    getPaidLeaveRemain: (date = new Date()) => {
      const ledger = loadPaidLeaveLedger_(date);
      return ledger ? paidLeaveRemain_(ledger, ymdKey_(date)) : null;
    },
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