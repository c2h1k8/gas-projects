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
 * スプレッドシートを開いたときにメニューを追加し、当月シートの今日の行を選択します。
 * 今日の行の色付けもここで張り直すので、色の定義を変えても作成済みのシートに反映されます。
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

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const current = ss.getSheetByName(MonthSheet.nameOf(new Date()));
  if (current) {
    MonthSheet.refreshRules(current);
    MonthSheet.focusToday(current);
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
 * 指定日の月のシートを作り、サマリを作り直します。
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

function menuCreateCurrentMonth() {
  showMonthResult_(createMonthSheet_(new Date()));
}

function menuCreateNextMonth() {
  const now = new Date();
  showMonthResult_(createMonthSheet_(new Date(now.getFullYear(), now.getMonth() + 1, 1)));
}

/**
 * 当月シートを消して、今のレイアウトと設定（入力単位・案件の選び方・刻み）で作り直します。
 * 入力済みの工数も消えるので、作り直す前にバックアップ（シートのコピー）を残すかを確認します。
 */
function menuRecreateCurrentMonth() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const now = new Date();
  const name = MonthSheet.nameOf(now);
  const existing = ss.getSheetByName(name);
  if (existing) {
    const answer = ui.alert('当月シートを作り直す',
      `${name} を、今のレイアウトと設定シートの内容（入力単位・案件の選び方・刻み）で作り直します。`
      + '入力済みの工数・備考は新しいシートには引き継がれません。\n\n'
      + '作り直す前にバックアップ（今のシートのコピー）を残しますか？\n'
      + '「はい」＝残して作り直す　「いいえ」＝残さずに作り直す　「キャンセル」＝やめる',
      ui.ButtonSet.YES_NO_CANCEL);
    if (answer === ui.Button.CANCEL || answer === ui.Button.CLOSE) return;
    withLock_(() => {
      if (answer === ui.Button.YES) backupSheet_(ss, existing);
      ss.deleteSheet(existing);
    });
  }
  showMonthResult_(createMonthSheet_(now));
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

function showMonthResult_({ sheet, created }) {
  sheet.activate();
  toast_(created ? `${sheet.getName()} を作成しました。` : `${sheet.getName()} は作成済みです。`);
}

function menuRebuildSummary() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  withLock_(() => SummarySheet.rebuild(ss));
  toast_('サマリを更新しました。');
}

function menuReflectReports() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  showReflectResults_(withLock_(() => ReportExporter.run(ss, ReportExporter.targetsForToday(ss))));
}

function menuReflectActiveMonth() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getActiveSheet();
  if (!Layout.MONTH_SHEET_PATTERN.test(sheet.getName())) {
    SpreadsheetApp.getUi().alert('反映したい月のシートを開いてから実行してください。');
    return;
  }
  showReflectResults_(withLock_(() => ReportExporter.run(ss, [sheet])));
}

function showReflectResults_(results) {
  const message = results.length
    ? results.map((r) => `${r.name}: ${r.ok ? '' : 'エラー '}${r.message}`).join('\n')
    : '反映する月シートがありません。';
  SpreadsheetApp.getUi().alert('報告シートへ反映', message, SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * サマリ・案件マスタ・設定・当月シートを作ります。既にあるシートには手を付けません。
 * 新規スプレッドシートの空の「シート1」は不要なので消します。
 */
function menuSetup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const { sheet } = createMonthSheet_(new Date());
  const blank = ss.getSheetByName('シート1') || ss.getSheetByName('Sheet1');
  if (blank && blank.getLastRow() === 0 && blank.getLastColumn() === 0) ss.deleteSheet(blank);
  MasterSheet.ensure(ss).activate();
  toast_(`${sheet.getName()} まで作成しました。案件マスタに案件を登録してください。`, 10);
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
