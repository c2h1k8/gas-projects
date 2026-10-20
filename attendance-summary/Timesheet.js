/**
 * 勤務表（月ごとのスプレッドシート）の読み取り。
 *
 * ⚠️ 勤務表のレイアウト（13行目開始 / E列=勤怠区分 / I列=出社 / L列=退社 / AD列=実働 / AJ列=休憩 / AD44=月合計）を
 *    知っているのは、このファイルと line-attendance の AttendanceHandler.js の2箇所です。
 *    別のGASプロジェクトなので共通化できません。勤務表テンプレートの列を変えたら
 *    両方を直してください。
 */
const Timesheet = (function () {
  /** 日付行の開始行 */
  const DATA_START_ROW = 13;

  /** 勤務表の列（0始まりのインデックス。getValues の結果を引くため） */
  const IDX = {
    DAY: 0,    // A列 日付
    TYPE: 4,   // E列 勤怠区分
    START: 8,  // I列 出社（打刻そのまま）
    END: 11,   // L列 退社（打刻そのまま）
    DIFF: 29,  // AD列 実働（休憩控除済み。出社・退社・合計を現場向けに丸めた値）
    BREAK: 35, // AJ列 休憩
  };
  /** 1行を読むときの列数（AJ列まで） */
  const ROW_WIDTH = 36;

  /** 月合計セル（未来の営業日の既定時刻を含むため、当月の着地見込みになる） */
  const RNG_TOTAL = 'AD44';
  /** 月合計セルの行。ここまで行が無いシートは勤務表ではないと判断する */
  const TOTAL_ROW = 44;

  /** 勤怠区分 */
  const TYPE = {
    WORKING: '出勤',
    REST: '欠勤',
    HOLIDAY: '有給休暇',
    DAIKYU: '代休',
    HOLIDAY_WORKING: '休日出勤',
  };

  /** スプレッドシートが時刻・時間を返すときの基準日（1899-12-30） */
  const EPOCH = new Date(1899, 11, 30);

  /**
   * セルの値を分に直します。
   *
   * 時間書式のセルは基準日からのDateとして返るため、基準日との差で分を出します。
   * 月合計のように24時間を超える値でも正しく扱えます。
   * @return 分 / 値が無ければ0
   */
  const toMinutes = (value) => {
    if (value instanceof Date) return Math.round((value.getTime() - EPOCH.getTime()) / 60000);
    if (typeof value === 'number') return Math.round(value * 24 * 60); // シリアル値（日）で返る場合
    const s = String(value || '').trim();
    if (!s) return 0;
    const m = s.match(/^(-?\d+):(\d{1,2})$/);
    return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
  };

  /**
   * 丸める前の実働（分）を返します。会社の残業（36協定）はこちらで管理するため。
   *
   * 実働（AD列）は現場向けに出社・退社・合計を丸めた値なので、
   * 打刻そのままの出社・退社と休憩から、会社の丸め単位で計算し直します（退社 − 出社 − 休憩）。
   * 丸め方は勤務表の数式（現場）と同じで、出社は切り上げ、退社と実働は切り捨てです。
   * 出社・退社が無い行（工数だけ手で入れた日など）は丸め後の実働で代えます。
   * @param row 勤務表の1行
   * @param rounded 丸め後の実働（分）
   * @param cfg 設定（会社の丸め単位）
   */
  const rawMinutes = (row, rounded, cfg) => {
    const s = row[IDX.START];
    const e = row[IDX.END];
    if (s === '' || s === null || e === '' || e === null) return rounded;
    // 時刻は日付部分を落として「その日の何分目か」で比べる
    const clock = (v) => ((toMinutes(v) % 1440) + 1440) % 1440;
    const unit = cfg.coRoundCalc;
    let mins = Math.floor(clock(e) / unit) * unit - Math.ceil(clock(s) / unit) * unit;
    if (mins < 0) mins += 1440; // 日付をまたいだ退社
    mins -= toMinutes(row[IDX.BREAK]);
    return Math.max(Math.floor(mins / cfg.coRoundTotal) * cfg.coRoundTotal, 0);
  };

  /** 分を小数時間に直します（単価を掛けるため h:mm では計算できない）。 */
  const toHours = (minutes) => Math.round((minutes / 60) * 100) / 100;

  /** 'yyyyMM' を返します。 */
  const ym = (date) => DateUtils.formatDate(date, 'yyyyMM');

  /**
   * 勤務表フォルダ内のスプレッドシートを列挙します。
   *
   * ここではファイルを開かず、メタデータだけを取ります。
   * 開くのが唯一の重い処理なので、最終更新日時で対象を絞ってから開くためです。
   *
   * @param dirId 勤務表フォルダのID
   * @param selfId このスプレッドシート自身のID（同じフォルダにあっても読まない）
   * @param excludeNames 除外するファイル名（テンプレートなど）
   * @return [{ id, name, created, updated }]
   */
  const listFiles = (dirId, selfId, excludeNames) => {
    const skipName = {};
    (excludeNames || []).forEach((n) => { skipName[n] = true; });

    const it = DriveApp.getFolderById(dirId).getFilesByType(MimeType.GOOGLE_SHEETS);
    const files = [];
    while (it.hasNext()) {
      const f = it.next();
      const id = f.getId();
      if (selfId && id === selfId) continue;
      const name = f.getName();
      if (skipName[name]) continue;
      files.push({ id, name, created: f.getDateCreated(), updated: f.getLastUpdated() });
    }
    return files;
  };

  /**
   * ファイルのメタデータだけを取ります（フォルダを走査しないときに使う）。
   * @return { id, name, created, updated } / 取得できなければnull
   */
  const fileMeta = (fileId) => {
    try {
      const f = DriveApp.getFileById(fileId);
      return { id: fileId, name: f.getName(), created: f.getDateCreated(), updated: f.getLastUpdated() };
    } catch (e) {
      // 索引に残っているが消された・権限が変わったファイル
      Logger.log('[Timesheet] ファイルを取得できません: %s (%s)', fileId, e.message);
      return null;
    }
  };

  /**
   * 勤務表を1ヶ月ぶん読み取ります。
   *
   * 年月はファイル名から推測しません。勤務表は翌月分の作成時にリネームされる仕様で、
   * 最新月だけ年月が付かないため、名前と中身がずれる瞬間があるからです。
   * 代わりに先頭行（その月の1日）の日付から年月を確定させます。
   *
   * @param fileId 勤務表のファイルID
   * @param cfg 設定
   * @return 集計結果 / 勤務表として読めなければnull
   */
  const readMonth = (fileId, cfg) => {
    const sheet = SpreadsheetApp.openById(fileId).getSheetByName(cfg.sheetName);
    if (!sheet) return null;
    // 勤務表以外のスプレッドシートが同じフォルダにあっても落ちないよう、範囲を先に確かめる
    if (sheet.getMaxRows() < TOTAL_ROW || sheet.getMaxColumns() < ROW_WIDTH) return null;

    const values = sheet.getRange(DATA_START_ROW, 1, SheetLayout.MAX_DAYS, ROW_WIDTH).getValues();
    const first = values[0][IDX.DAY];
    if (!(first instanceof Date)) return null;

    const year = first.getFullYear();
    const month = first.getMonth();
    const targetYm = ym(first);
    const nowYm = ym(new Date());

    // 未来の行には既定の時刻が入っており実績ではないため、当月は今日で打ち切る。
    // 過去月は末日まで確定、未来月は実績なし。
    const today = new Date();
    let through;
    if (targetYm < nowYm) through = SheetLayout.MAX_DAYS;
    else if (targetYm === nowYm) through = today.getDate();
    else through = 0;

    const stdMinutes = cfg.stdHours * 60;
    const counts = { workDays: 0, paid: 0, absent: 0, daikyu: 0, holidayWork: 0 };
    // 精算に使う時間（設定により有給・代休を含む）と、実際に働いた時間を分けて持つ。
    // 残業は働いた時間だけで出す。有給の8hを足すと、稼働日数には入らないぶんがそのまま残業に乗るため。
    let settleMinutes = 0;
    let workedMinutes = 0;
    // 働いた時間の丸める前（会社の管理）。現場は丸めた時間（workedMinutes）で数える
    let rawWorkedMinutes = 0;
    const days = [];

    for (let i = 0; i < SheetLayout.MAX_DAYS; i++) {
      const dayNo = i + 1;
      const cell = values[i][IDX.DAY];
      const exists = cell instanceof Date && cell.getMonth() === month && cell.getFullYear() === year;
      if (!exists) {
        days.push({ exists: false, biz: false, type: '', hours: null });
        continue;
      }

      const date = new Date(year, month, dayNo);
      const type = String(values[i][IDX.TYPE] || '');
      const biz = DateUtils.isBizDate(date);

      if (dayNo > through) {
        // まだ実績になっていない日。先に登録した休暇は色で見えるよう区分だけ残し、時間は空にする
        days.push({ exists: true, biz, type, hours: null });
        continue;
      }

      let minutes = toMinutes(values[i][IDX.DIFF]);
      let worked = false;
      switch (type) {
        case TYPE.WORKING:
          // 土日祝の行は勤務表のひな形で「出勤」になっていることがある。
          // 稼働日数に数えると所定が膨らむので、働いた日だけ休日出勤として扱う
          if (biz) counts.workDays++;
          else if (minutes) counts.holidayWork++;
          worked = true;
          break;
        case TYPE.HOLIDAY_WORKING:
          counts.holidayWork++;
          worked = true;
          break;
        case TYPE.HOLIDAY:
          counts.paid++;
          // 契約上、有給を稼働時間として精算に含める場合は所定労働時間ぶんを足す
          if (cfg.includeLeave && !minutes) minutes = stdMinutes;
          break;
        case TYPE.DAIKYU:
          counts.daikyu++;
          if (cfg.includeLeave && !minutes) minutes = stdMinutes;
          break;
        case TYPE.REST:
          counts.absent++;
          minutes = 0;
          break;
        default:
          // 未登録・クリア済みの日
          minutes = 0;
          break;
      }

      settleMinutes += minutes;
      if (worked && minutes) {
        workedMinutes += minutes;
        rawWorkedMinutes += rawMinutes(values[i], minutes, cfg);
      }
      days.push({ exists: true, biz, type, hours: minutes ? toHours(minutes) : null });
    }

    // 見込みは月合計セルから。確定済みの過去月では実績と同じになるので出さない
    const forecast = targetYm >= nowYm ? toHours(toMinutes(sheet.getRange(RNG_TOTAL).getValue())) : null;

    return {
      ym: targetYm,
      workDays: counts.workDays,
      paid: counts.paid,
      absent: counts.absent,
      daikyu: counts.daikyu,
      holidayWork: counts.holidayWork,
      settleHours: toHours(settleMinutes),
      actualHours: toHours(workedMinutes),
      rawHours: toHours(rawWorkedMinutes),
      forecastHours: forecast,
      days,
    };
  };

  /** 日別セルの背景色を決めます。区分の色を優先し、無ければ休日かどうかで塗ります。 */
  const dayColor = (day) => {
    const BG = SheetLayout.BG;
    if (!day.exists) return BG.NONE;
    switch (day.type) {
      case TYPE.HOLIDAY: return BG.PAID;
      case TYPE.DAIKYU: return BG.DAIKYU;
      case TYPE.REST: return BG.ABSENT;
      default: return day.biz ? BG.NORMAL : BG.HOLIDAY;
    }
  };

  /** プロパティに保存して文字列になった日時をDateへ戻します。 */
  const toDate = (v) => {
    if (v instanceof Date) return v;
    if (!v) return '';
    const d = new Date(v);
    return isNaN(d.getTime()) ? '' : d;
  };

  return { TYPE, listFiles, fileMeta, readMonth, dayColor, toMinutes, toHours, ym, toDate };
})();
