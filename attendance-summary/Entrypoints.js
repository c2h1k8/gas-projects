/**
 * メニューとトリガの入口。
 *
 * 反映は日次トリガ（既定3時）で行い、メニューは初期化・再集計・手動反映のために置いています。
 */

/** 日次トリガの実行時刻（時。3時＝前日ぶんが確定した後） */
const TRIGGER_HOUR = 3;
/** 日次トリガから呼ぶ関数名 */
const TRIGGER_FUNC = 'dailyRefresh';

/** スプレッドシートを開いたときにメニューを追加します。 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('勤怠サマリ')
    .addItem('今すぐ更新', 'menuRefresh')
    .addItem('全期間を再集計', 'menuRefreshAll')
    .addSeparator()
    .addItem('シート初期化', 'menuSetupSheets')
    .addItem('ファイル索引をクリア', 'menuClearIndex')
    .addItem('日次トリガを設定', 'menuSetupTrigger')
    .addItem('日次トリガを解除', 'menuRemoveTrigger')
    .addToUi();
}

/**
 * 更新を実行します。
 * トリガと手動が重なるとシートを二重に書き換えてしまうため、実行中は後から来た方を諦めさせます。
 * @param full 全期間を読み直すか
 * @return 件数
 */
function runRefresh_(full, onProgress) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('別の更新が実行中です。しばらく待ってから再実行してください。');
  try {
    return SummaryService.refresh(full, onProgress);
  } finally {
    lock.releaseLock();
  }
}

/**
 * 進捗ダイアログを出しながら更新します。
 *
 * 勤務表を1件ずつ開くので、全期間の再集計は分単位で待たされます。
 * トーストだと消えてしまい今どこまで進んだか分からないため、
 * 共通のローディング画面に「何月を読んでいるか」を出し続けます。
 */
function runWithProgress_(startHint, full) {
  LoadingUI.open(startHint);
  try {
    const result = runRefresh_(full, (message) => LoadingUI.hint(message));
    LoadingUI.complete(describe_(result));
  } catch (e) {
    LoadingUI.error(e.message);
    throw e;
  }
}

/** 日次トリガから呼ばれます（差分更新）。 */
function dailyRefresh() {
  const r = runRefresh_(false);
  Logger.log('[dailyRefresh] 読込%s件 / スキップ%s件', r.read, r.skipped);
}

/** メニュー: 今すぐ更新（差分） */
function menuRefresh() {
  runWithProgress_('更新しています…', false);
}

/** メニュー: 全期間を再集計 */
function menuRefreshAll() {
  runWithProgress_('全期間を再集計しています…', true);
}

/**
 * 結果の要約を作ります。
 * 契約シートに該当が無い月は金額が出ないため、気づけるよう件数を添えます。
 */
function describe_(r) {
  const parts = [`${r.months}ヶ月`, `読込 ${r.read}件`, `スキップ ${r.skipped}件`];
  if (r.scanned) parts.push('フォルダ走査あり');
  if (r.noContract) parts.push(`⚠️ 契約が見つからない月 ${r.noContract}件`);
  return parts.join(' / ');
}

/** メニュー: シート初期化 */
function menuSetupSheets() {
  withToast_('シートを初期化中…', () => {
    SheetLayout.setup(SpreadsheetApp.getActiveSpreadsheet());
    return '初期化しました。設定シートを入力してから「今すぐ更新」を実行してください。';
  });
}

/**
 * メニュー: ファイル索引をクリア
 * 勤務表を入れ替えた・フォルダを変えたなど、索引と実体がずれたときに使います。
 */
function menuClearIndex() {
  withToast_('索引を消しています…', () => {
    FileIndex.clear();
    return '索引を消しました。次の更新でフォルダを走査し直します。';
  });
}

/** メニュー: 日次トリガを設定（重複しないよう既存を消してから作る） */
function menuSetupTrigger() {
  withToast_('トリガを設定中…', () => {
    removeTriggers_();
    ScriptApp.newTrigger(TRIGGER_FUNC).timeBased().atHour(TRIGGER_HOUR).everyDays(1).create();
    return `毎日${TRIGGER_HOUR}時台に更新するトリガを設定しました。`;
  });
}

/** メニュー: 日次トリガを解除 */
function menuRemoveTrigger() {
  withToast_('トリガを解除中…', () => {
    const n = removeTriggers_();
    return n ? `トリガを解除しました（${n}件）` : '設定済みのトリガはありませんでした。';
  });
}

/** このプロジェクトの更新トリガを全て削除します。 */
function removeTriggers_() {
  const targets = ScriptApp.getProjectTriggers().filter((t) => t.getHandlerFunction() === TRIGGER_FUNC);
  targets.forEach((t) => ScriptApp.deleteTrigger(t));
  return targets.length;
}

/**
 * 処理中と結果をトーストで知らせます。
 * 失敗した内容が分からないまま終わるのを避けるため、例外もトーストに出してから投げ直します。
 */
function withToast_(startMessage, fn) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.toast(startMessage, '勤怠サマリ', 5);
  try {
    const message = fn();
    ss.toast(message, '勤怠サマリ', 10);
  } catch (e) {
    ss.toast(e.message, '勤怠サマリ エラー', 30);
    throw e;
  }
}
