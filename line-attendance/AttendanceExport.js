/**
 * 登録した勤怠の書き出し。
 *
 * 勤務表へ登録した内容を、Drive上のJSONファイルへ1日1件で残します。
 * このファイルを何に使うかはここの関心ではありません（外部のツールが取り込みます）。
 *
 * 要素は書き出したら残り続け、取り込んだ側が消します。
 * つまり「要素がある＝まだ取り込まれていない」という状態になるため、
 * ここでは書き出し済みフラグや台帳を持ちません。
 *
 * ファイル形式（UTF-8・work_date昇順の配列）:
 *   [
 *     { "work_date": "2026-08-08", "type": "出勤", "start": "09:30",
 *       "end": "18:30", "work_time": "08:00", "holiday_work_date": "" },
 *     { "work_date": "2026-08-10", "type": "有給休暇", "start": "",
 *       "end": "", "work_time": "", "holiday_work_date": "" }
 *   ]
 *
 * 値は勤務表から解決済みのものだけを書きます（時刻・実働・代休の振替元）。
 * 勤務表のレイアウトを知っているのはこのプロジェクトだけなので、
 * 読み取り側がシートの構造を意識せずに済むようにするためです。
 *
 * 設定（スクリプトプロパティ）:
 *   EXPORT_FILE_ID … 書き出し先のファイルID
 * 未設定なら何もしません（＝書き出しを安全に無効化できる）。
 */
const AttendanceExport = (function () {
  const FIELDS = ['work_date', 'type', 'start', 'end', 'work_time', 'holiday_work_date'];
  const LOCK_NAME = 'AttendanceExport';
  const FILE_NAME = 'attendance-export.json';
  const EMPTY = '[]\n';

  /**
   * 書き出す勤怠区分。勤務表に入る区分（AttendanceHandler.js の TYPE）と同じ値だが、
   * ファイルの評価順に依存しないようここでは文字列として持つ。
   * クリアと未登録は含めない。
   */
  const EXPORT_TYPES = ['出勤', '休日出勤', '有給休暇', '欠勤', '代休'];

  /** 書き出し対象の勤怠区分か（クリア・未登録は対象外） */
  const isExportTarget = (type) => EXPORT_TYPES.indexOf(type) >= 0;

  const fileId_ = () => Props.getValue(PKeys.EXPORT_FILE_ID);

  /**
   * 書き出し先が設定されているかを返します。
   */
  const isConfigured = () => !!fileId_();

  /**
   * ファイル本文を要素の配列に変換します。
   * 壊れていた場合に勤怠登録まで巻き添えにしないよう、パース失敗は空として扱います
   * （取りこぼしは書き出し直しで復旧できる）。
   */
  const parse_ = (text) => {
    const body = String(text || '').replace(/^﻿/, '').trim();
    if (!body) return [];
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch (e) {
      Logger.log('[AttendanceExport] 書き出し先が壊れています。作り直します: %s', e.message);
      return [];
    }
    if (!Array.isArray(parsed)) {
      Logger.log('[AttendanceExport] 書き出し先が配列ではありません。作り直します。');
      return [];
    }
    return parsed.filter((r) => r && r.work_date);
  };

  /**
   * 要素の配列をファイル本文に戻します（work_date昇順）。
   * 欠けたキーは空文字で埋め、読み取り側が常に同じ形を受け取れるようにする。
   */
  const build_ = (rows) => {
    const sorted = rows.slice().sort((a, b) => (a.work_date < b.work_date ? -1 : a.work_date > b.work_date ? 1 : 0));
    const normalized = sorted.map((r) => {
      const row = {};
      FIELDS.forEach((f) => { row[f] = r[f] || ''; });
      return row;
    });
    return JSON.stringify(normalized, null, 2) + '\n';
  };

  /**
   * 1日分を書き出します。
   *
   * 同じ日付の要素が既にあれば置き換えます（1日1件・最新の内容が勝つ）。
   * 出社だけ登録→あとで退社を登録、のように同じ日が何度も更新されるため、
   * 追加のままだと同じ日の要素が積み重なってしまいます。
   *
   * @param row { work_date, type, start, end, work_time, holiday_work_date }
   * @return 成否（未設定・対象外はfalse）
   */
  const write = (row) => {
    if (!isConfigured()) {
      Logger.log('[AttendanceExport] EXPORT_FILE_ID 未設定のためスキップ');
      return false;
    }
    if (!row || !row.work_date || !isExportTarget(row.type)) return false;

    if (!LockUtil.tryLock(LOCK_NAME)) {
      // 同時書き込みでファイルを壊さないため、取れなければ少し待って1回だけ再試行する
      Utilities.sleep(1500);
      if (!LockUtil.tryLock(LOCK_NAME)) {
        throw new Error('書き出し先がロック中で書き込めませんでした。');
      }
    }
    try {
      const file = DriveApp.getFileById(fileId_());
      const rows = parse_(file.getBlob().getDataAsString('UTF-8'));
      const remain = rows.filter((r) => r.work_date !== row.work_date);
      remain.push(row);
      file.setContent(build_(remain));
      Logger.log('[AttendanceExport] %s %s を書き出し（計%s件）', row.work_date, row.type, remain.length);
      return true;
    } finally {
      LockUtil.releaseLock(LOCK_NAME);
    }
  };

  /**
   * 指定日を書き出し先から取り下げます。
   *
   * 登録をクリアしたのに書き出し先に残っていると、取り込み側が
   * 取り消したはずの勤怠を登録してしまうため、こちらからも消します。
   *
   * @param dateStr 対象日 'yyyy-MM-dd'
   * @return 取り下げた件数（元から無ければ0）
   */
  const remove = (dateStr) => {
    if (!isConfigured() || !dateStr) return 0;

    if (!LockUtil.tryLock(LOCK_NAME)) {
      Utilities.sleep(1500);
      if (!LockUtil.tryLock(LOCK_NAME)) {
        throw new Error('書き出し先がロック中で書き込めませんでした。');
      }
    }
    try {
      const file = DriveApp.getFileById(fileId_());
      const rows = parse_(file.getBlob().getDataAsString('UTF-8'));
      const remain = rows.filter((r) => r.work_date !== dateStr);
      if (remain.length === rows.length) return 0; // 元から無いので書き込まない
      file.setContent(build_(remain));
      Logger.log('[AttendanceExport] %s を取り下げ（残り%s件）', dateStr, remain.length);
      return rows.length - remain.length;
    } finally {
      LockUtil.releaseLock(LOCK_NAME);
    }
  };

  /**
   * 複数日をまとめて書き出します（書き出し直し・後追い用）。
   *
   * 1日ずつ write() を呼ぶとDriveの読み書きが件数分走って遅いため、
   * 1回の読み書きで済ませます。同じ日付の既存要素は置き換えます。
   *
   * @param rows 書き出す要素の配列
   * @return 書き出した件数
   */
  const writeMany = (rows) => {
    if (!isConfigured()) {
      Logger.log('[AttendanceExport] EXPORT_FILE_ID 未設定のためスキップ');
      return 0;
    }
    const targets = (rows || []).filter((r) => r && r.work_date && isExportTarget(r.type));
    if (!targets.length) return 0;

    if (!LockUtil.tryLock(LOCK_NAME)) {
      Utilities.sleep(1500);
      if (!LockUtil.tryLock(LOCK_NAME)) {
        throw new Error('書き出し先がロック中で書き込めませんでした。');
      }
    }
    try {
      const file = DriveApp.getFileById(fileId_());
      const current = parse_(file.getBlob().getDataAsString('UTF-8'));
      const replaced = new Set(targets.map((r) => r.work_date));
      const merged = current.filter((r) => !replaced.has(r.work_date)).concat(targets);
      file.setContent(build_(merged));
      Logger.log('[AttendanceExport] %s件を書き出し（計%s件）', targets.length, merged.length);
      return targets.length;
    } finally {
      LockUtil.releaseLock(LOCK_NAME);
    }
  };

  /**
   * 書き出し済みの内容を返します（確認用）。
   */
  const list = () => {
    if (!isConfigured()) return [];
    const file = DriveApp.getFileById(fileId_());
    return parse_(file.getBlob().getDataAsString('UTF-8'));
  };

  /**
   * 書き出し先を空にします（確認・復旧用）。
   */
  const clear = () => {
    if (!isConfigured()) return;
    DriveApp.getFileById(fileId_()).setContent(EMPTY);
    Logger.log('[AttendanceExport] 書き出し先を空にしました');
  };

  /**
   * 書き出し先を新規作成します（初回セットアップ用）。
   * 作成したファイルIDをログに出すので、EXPORT_FILE_ID に設定してください。
   * @param folderId 作成先フォルダID（省略時はマイドライブ直下）
   * @return 作成したファイルID
   */
  const createFile = (folderId) => {
    const blob = Utilities.newBlob(EMPTY, 'application/json', FILE_NAME);
    const file = folderId ? DriveApp.getFolderById(folderId).createFile(blob) : DriveApp.createFile(blob);
    Logger.log('[AttendanceExport] 書き出し先を作成しました\n  fileId: %s\n  URL: %s', file.getId(), file.getUrl());
    Logger.log('  → EXPORT_FILE_ID に上記 fileId を設定してください。');
    return file.getId();
  };

  /**
   * 既存の書き出し先をファイル名で探してIDを返します（初回セットアップ用）。
   * Drive for Desktop の同期フォルダ側でファイルを作った場合、
   * ファイルIDが手元に無いためここで引き当てます。
   * @param name ファイル名（省略時は既定名）
   * @return 見つかったファイルIDの配列
   */
  const findFile = (name) => {
    const target = name || FILE_NAME;
    const it = DriveApp.getFilesByName(target);
    const found = [];
    while (it.hasNext()) {
      const f = it.next();
      found.push(f.getId());
      Logger.log('[AttendanceExport] %s\n  fileId: %s\n  URL: %s', f.getName(), f.getId(), f.getUrl());
    }
    if (!found.length) {
      Logger.log('[AttendanceExport] "%s" が見つかりません。同期が終わっているか確認してください。', target);
    } else if (found.length > 1) {
      Logger.log('[AttendanceExport] 同名ファイルが %s 件あります。使うものを選んでください。', found.length);
    } else {
      Logger.log('  → EXPORT_FILE_ID に上記 fileId を設定してください。');
    }
    return found;
  };

  return { isConfigured, isExportTarget, write, writeMany, remove, list, clear, createFile, findFile };
})();

// ===== GASエディタから実行するためのグローバル関数 =====

/** 書き出し先を新規作成します（初回のみ。作成後はfileIdをプロパティへ設定） */
function attendanceExportCreateFile() { AttendanceExport.createFile(); }

/** 既存の書き出し先をファイル名で探してIDを表示します（同期フォルダ側で作った場合） */
function attendanceExportFindFile() { AttendanceExport.findFile(); }

/** 書き出し済みの内容を表示します */
function attendanceExportList() {
  const rows = AttendanceExport.list();
  if (!rows.length) {
    Logger.log('書き出し先は空です。');
    return;
  }
  Logger.log('書き出し済み %s件', rows.length);
  rows.forEach((r) => Logger.log('  %s %s %s %s 実働%s %s',
    r.work_date, r.type, r.start, r.end, r.work_time, r.holiday_work_date ? '振替元' + r.holiday_work_date : ''));
}

/** 書き出し先を空にします */
function attendanceExportClear() { AttendanceExport.clear(); }

/**
 * 当月1日から今日までの登録済み勤怠をまとめて書き出します（後追い用）。
 *
 * 書き出しを後から有効にした場合や、書き出し先を作り直した場合に使います。
 * 既に書き出し済みの日は最新の内容で置き換わるので、何度実行しても構いません。
 * 未来日は勤務表に既定値が入っているだけで実績ではないため対象外です。
 */
function attendanceExportBackfill() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  Logger.log('========== 書き出し: %s 〜 %s ==========',
    DateUtils.formatDate(from, 'yyyy-MM-dd'), DateUtils.formatDate(to, 'yyyy-MM-dd'));

  const r = MainProc.exportRange(from, to);
  r.skipped.forEach((s) => Logger.log('  -- %s  %s', s.dateStr, s.reason));
  r.failed.forEach((f) => Logger.log('  NG %s  %s', f.dateStr, f.msg));
  Logger.log('========== 書き出し %s件 / 対象外 %s件 / 失敗 %s件 ==========',
    r.exported, r.skipped.length, r.failed.length);
}
