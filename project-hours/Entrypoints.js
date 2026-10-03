/**
 * メニュー・トリガーの入口。
 *
 * トリガーは3つです（どれも push では作られないので、初回だけメニューの「トリガーを設定」を実行する）。
 *   - 毎月1日0時台: 当月シートを作る（createCurrentMonthSheet）
 *   - 毎日、設定シートの反映時刻: 報告シートへ当月分を書き込む（reflectReports。月初の数日は前月分も）
 *   - 編集時: 案件マスタを編集したらサマリを作り直す（onMasterEdit）。
 *     シンプルトリガーの onEdit では Sheets API を使えず、サマリの報告シート列のスマートチップの
 *     リンク先を読めない（作り直しで消えてしまう）ため、インストール型にしている
 */

/** 月次トリガーから呼ぶ関数名 */
const MONTHLY_TRIGGER_FUNC = 'createCurrentMonthSheet';
/** 毎日のトリガーから呼ぶ関数名 */
const DAILY_TRIGGER_FUNC = 'reflectReports';
/** 編集時のトリガーから呼ぶ関数名 */
const EDIT_TRIGGER_FUNC = 'onMasterEdit';
const APP_TITLE = '工数管理';

/**
 * スプレッドシートを開いたときにメニューを追加し、当月シートを開いていれば今日の行を選択します
 * （他のシートを開いていたら切り替えない。リロードのたびに当月シートへ飛ばされないように）。
 * 今日の行の色付けは月シートの条件付き書式（TODAY()）なので、ここでは何もしない。
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu(APP_TITLE)
    .addItem('当月シートを作成', 'menuCreateCurrentMonth')
    .addItem('翌月シートを作成', 'menuCreateNextMonth')
    .addItem('当月シートを作り直す', 'menuRecreateCurrentMonth')
    .addItem('サマリを更新', 'menuRebuildSummary')
    .addSeparator()
    .addItem('報告シートへ反映（当月）', 'menuReflectReports')
    .addItem('表示中の月を報告シートへ反映', 'menuReflectActiveMonth')
    .addSeparator()
    .addItem('初期設定（シート作成）', 'menuSetup')
    .addItem('トリガーを設定', 'menuSetupTrigger')
    .addItem('トリガーを解除', 'menuRemoveTrigger')
    .addToUi();

  // ここから先は失敗してもメニューの表示には影響させない（ログだけ残す）
  try {
    MonthSheet.focusToday(SpreadsheetApp.getActiveSpreadsheet().getActiveSheet());
  } catch (e) {
    console.warn(`onOpen: 今日の行の選択に失敗しました: ${e.message}`);
  }
}

/**
 * 案件マスタを編集したらサマリの列（案件）を作り直します。
 * 月シートの入力はサマリの数式がそのまま拾うので、ここでは何もしません。
 */
function onMasterEdit(e) {
  if (!e || e.range.getSheet().getName() !== Layout.MASTER_SHEET) return;
  withLock_(() => SummarySheet.rebuild(e.source));
}

/** 月次トリガー（毎月1日0時）から呼ばれます。当月シートを作ります。 */
function createCurrentMonthSheet() {
  createMonthSheet_(new Date());
}

/** 毎日のトリガーから呼ばれます。当月分（月初の数日は前月分も）を報告シートへ書き込みます。 */
function reflectReports() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const results = withLock_(() => ReportExporter.run(ss, ReportExporter.targetsForToday(ss)));
  const failed = results.filter((r) => !r.ok);
  // トリガーの失敗はメールで通知されるので、失敗した月があれば例外にして気づけるようにする
  if (failed.length) throw new Error(`報告シートへの反映に失敗: ${failed.map((r) => `${r.name} ${r.message}`).join(' / ')}`);
}

/**
 * 指定日の月のシートを作り、サマリを作り直します（月次トリガー用。メニューからは進捗ダイアログ経由）。
 * @return { sheet, created }
 */
function createMonthSheet_(date) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return withLock_(() => {
    SummarySheet.ensure(ss);
    MasterSheet.ensure(ss);
    SettingsSheet.ensure(ss);
    const result = MonthSheet.ensure(ss, date);
    if (result.created) SummarySheet.rebuild(ss);
    return result;
  });
}

/** トリガーと手動が重なってシートを二重に作らないよう、ドキュメント単位で直列化します。 */
function withLock_(fn) {
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(30000)) throw new Error('別の処理が実行中です。しばらく待ってから再実行してください。');
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function toast_(message, seconds = 5) {
  SpreadsheetApp.getActiveSpreadsheet().toast(message, APP_TITLE, seconds);
}

// ===== メニュー（時間のかかる処理は進捗ダイアログで手順を1つずつ実行する。手順の定義は StepActions.js） =====

function menuCreateCurrentMonth() {
  StepDialog.open('createMonth', { offset: 0 });
}

function menuCreateNextMonth() {
  StepDialog.open('createMonth', { offset: 1 });
}

/** 当月シートを作り直します。バックアップを残すかはダイアログの中で選ぶ。 */
function menuRecreateCurrentMonth() {
  StepDialog.open('recreateMonth');
}

function menuRebuildSummary() {
  StepDialog.open('rebuildSummary');
}

function menuReflectReports() {
  StepDialog.open('reflect', { mode: 'today' });
}

function menuReflectActiveMonth() {
  StepDialog.open('reflect', { mode: 'active' });
}

/** サマリ・案件マスタ・設定・当月シートを作ります。既にあるシートには手を付けません。 */
function menuSetup() {
  StepDialog.open('setup');
}

/**
 * シートのコピーをバックアップとして末尾に残します（例: 2026-10_バックアップ_20261003-1052）。
 * 名前が月シートの形ではないので、サマリや報告シートへの反映の対象にはならない。
 */
function backupSheet_(ss, sheet) {
  const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmm');
  const backup = sheet.copyTo(ss).setName(`${sheet.getName()}_バックアップ_${stamp}`);
  backup.setTabColor(Style.COLOR.TAB_SETTING);
  backup.protect().setDescription('バックアップ（参照用）').setWarningOnly(true);
  ss.setActiveSheet(backup);
  ss.moveActiveSheet(ss.getNumSheets());
  return backup;
}

function menuSetupTrigger() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  removeTriggers_();
  const hour = SettingsSheet.reportHour(ss);
  // atHour は「その時台のどこか」で実行される（分は指定できない）
  ScriptApp.newTrigger(MONTHLY_TRIGGER_FUNC).timeBased().onMonthDay(1).atHour(0).create();
  ScriptApp.newTrigger(DAILY_TRIGGER_FUNC).timeBased().everyDays(1).atHour(hour).create();
  ScriptApp.newTrigger(EDIT_TRIGGER_FUNC).forSpreadsheet(ss).onEdit().create();
  toast_(`毎月1日0時台に当月シートを作成し、毎日${hour}時台に報告シートへ反映します。案件マスタの編集でサマリも更新します。`, 10);
}

function menuRemoveTrigger() {
  const removed = removeTriggers_();
  toast_(removed ? 'トリガーを解除しました。' : 'トリガーは設定されていません。');
}

/** このプロジェクトのトリガーをすべて削除し、削除した数を返します。 */
function removeTriggers_() {
  const funcs = [MONTHLY_TRIGGER_FUNC, DAILY_TRIGGER_FUNC, EDIT_TRIGGER_FUNC];
  const targets = ScriptApp.getProjectTriggers().filter((t) => funcs.includes(t.getHandlerFunction()));
  targets.forEach((t) => ScriptApp.deleteTrigger(t));
  return targets.length;
}
