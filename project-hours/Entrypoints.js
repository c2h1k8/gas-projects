/**
 * メニュー・トリガーの入口。
 *
 * トリガーは2つです（どちらも push では作られないので、初回だけメニューの「トリガーを設定」を実行する）。
 *   - 毎月1日0時台: 当月シートを作る（createCurrentMonthSheet）
 *   - 毎日、設定シートの反映時刻: 報告シートへ当月分を書き込む（reflectReports。月初の数日は前月分も）
 * 案件マスタを編集したときは、メニューの「サマリを更新」でサマリを作り直す。
 */

/** 月次トリガーから呼ぶ関数名 */
const MONTHLY_TRIGGER_FUNC = 'createCurrentMonthSheet';
/** 毎日のトリガーから呼ぶ関数名 */
const DAILY_TRIGGER_FUNC = 'reflectReports';
const APP_TITLE = '工数管理';

/**
 * スプレッドシートを開いたときにメニューを追加し、当月シートを開いていれば今日の行を選択します
 * （他のシートを開いていたら切り替えない。リロードのたびに当月シートへ飛ばされないように）。
 * 今日の行の色付けは月シートの条件付き書式（TODAY()）なので、ここでは何もしない。
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  // シートが増えてもすぐ開けるよう、よく使うシートへの移動をまとめる
  const jump = ui.createMenu('シートへ移動')
    .addItem('サマリ', 'menuGoSummary')
    .addItem('当月シート', 'menuGoCurrentMonth')
    .addItem('案件マスタ', 'menuGoMaster')
    .addItem('設定', 'menuGoSettings');
  ui.createMenu(APP_TITLE)
    .addSubMenu(jump)
    .addSeparator()
    .addItem('当月シートを作成', 'menuCreateCurrentMonth')
    .addItem('翌月シートを作成', 'menuCreateNextMonth')
    .addItem('年月を指定してシートを作成', 'menuCreateSpecifiedMonth')
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

/**
 * このツールが作るシート（サマリ・月シート・バックアップ・案件マスタ・設定）をすべて消して、初期設定からやり直します。
 * 入力済みの工数・案件マスタ・設定はすべて消えるので、メニューには出さず GAS エディタから実行する（レイアウトを変えたときの作り直し用）。
 * 自分で足した他のシートとトリガーはそのまま。報告シートへ前回書いた行数の記録も残す（報告ファイルに古い行を残さないため）。
 */
function resetAllSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const backup = /_バックアップ_\d{8}-\d{4}$/;
  const leftover = /^作り直し中_\d+$/; // 前回途中で止まったときの仮のシート
  const own = (s) => [Layout.SUMMARY_SHEET, Layout.MASTER_SHEET, Layout.SETTINGS_SHEET].includes(s.getName())
    || Layout.MONTH_SHEET_PATTERN.test(s.getName()) || backup.test(s.getName()) || leftover.test(s.getName());
  const started = Date.now();
  const log = (msg) => console.log(`[${((Date.now() - started) / 1000).toFixed(1)}秒] ${msg}`);
  withLock_(() => {
    // シートを全部は消せないので、作り直すまでの仮のシートを置いておく（失敗しても最後に消す）
    const temp = ss.insertSheet(`作り直し中_${started}`);
    try {
      const targets = ss.getSheets().filter((s) => own(s) && s.getSheetId() !== temp.getSheetId());
      log(`${targets.length}枚のシートを削除します`);
      targets.forEach((s) => ss.deleteSheet(s));
      log('サマリを作成');
      SummarySheet.ensure(ss);
      log('案件マスタを作成');
      MasterSheet.ensure(ss);
      log('設定を作成');
      SettingsSheet.ensure(ss);
      log('当月シートを作成');
      MonthSheet.ensure(ss, new Date());
      log('サマリを更新');
      SummarySheet.rebuild(ss);
    } finally {
      ss.deleteSheet(temp);
    }
  });
  log('すべてのシートを作り直しました');
}

// ===== シートへ移動 =====

function menuGoSummary() {
  goToSheet_(Layout.SUMMARY_SHEET);
}

/** 当月シートを開いて今日の行を選びます（無ければ作り方を案内する）。 */
function menuGoCurrentMonth() {
  const sheet = goToSheet_(MonthSheet.nameOf(new Date()), '当月シートがまだありません。メニューの「当月シートを作成」から作れます。');
  if (sheet) MonthSheet.focusToday(sheet);
}

function menuGoMaster() {
  goToSheet_(Layout.MASTER_SHEET);
}

function menuGoSettings() {
  goToSheet_(Layout.SETTINGS_SHEET);
}

/** シートを開きます。無ければトーストで知らせて null を返します。 */
function goToSheet_(name, missing = `「${name}」シートがありません。メニューの「初期設定（シート作成）」から作れます。`) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) {
    toast_(missing);
    return null;
  }
  sheet.activate();
  return sheet;
}

function menuCreateCurrentMonth() {
  StepDialog.open('createMonth', { offset: 0 });
}

function menuCreateNextMonth() {
  StepDialog.open('createMonth', { offset: 1 });
}

/** 年月を指定して一度に作れる月の数（1回の操作で作りすぎないように） */
const SPECIFIED_MONTHS_MAX = 36;

/**
 * 年月を入力して、その月のシートを作ります（過去の月の工数を後から手で入れるときなど）。
 * 「2025-04」で1ヶ月、「2025-04〜2025-09」で期間をまとめて作る。年月は 2025/4・202504・2025年4月 の形でもよい。
 */
function menuCreateSpecifiedMonth() {
  const ui = SpreadsheetApp.getUi();
  const res = ui.prompt('年月を指定してシートを作成',
    '作成する年月を入力してください。\n1ヶ月なら「2025-04」、期間なら「2025-04〜2025-09」', ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;
  const months = parseMonthRange_(res.getResponseText());
  if (typeof months === 'string') {
    ui.alert(months);
    return;
  }
  StepDialog.open('createMonths', { months });
}

/**
 * 「2025-04」または「2025-04〜2025-09」を、古い順の月シート名の配列にします。
 * 不正な入力ならエラーの文言（文字列）を返します。
 */
function parseMonthRange_(text) {
  const toMonth = (t) => {
    const m = String(t).trim().match(/^(\d{4})[-/年]?(\d{1,2})月?$/);
    return m && Number(m[2]) >= 1 && Number(m[2]) <= 12 ? { y: Number(m[1]), m: Number(m[2]) } : null;
  };
  const parts = String(text).trim().split(/\s*(?:[〜~～]|から)\s*/);
  const from = toMonth(parts[0]);
  const to = parts.length === 2 ? toMonth(parts[1]) : (parts.length === 1 ? from : null);
  if (!from || !to) return '年月は「2025-04」、期間は「2025-04〜2025-09」のように入力してください。';
  const count = (to.y - from.y) * 12 + (to.m - from.m) + 1;
  if (count < 1) return '期間は古い月〜新しい月の順に入力してください。';
  if (count > SPECIFIED_MONTHS_MAX) return `一度に作れるのは ${SPECIFIED_MONTHS_MAX} ヶ月までです。期間を分けて実行してください。`;
  return [...Array(count).keys()].map((i) => MonthSheet.nameOf(new Date(from.y, from.m - 1 + i, 1)));
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
  toast_(`毎月1日0時台に当月シートを作成し、毎日${hour}時台に報告シートへ反映します。`, 10);
}

function menuRemoveTrigger() {
  const removed = removeTriggers_();
  toast_(removed ? 'トリガーを解除しました。' : 'トリガーは設定されていません。');
}

/** このプロジェクトのトリガーをすべて削除し、削除した数を返します。 */
function removeTriggers_() {
  const funcs = [MONTHLY_TRIGGER_FUNC, DAILY_TRIGGER_FUNC];
  const targets = ScriptApp.getProjectTriggers().filter((t) => funcs.includes(t.getHandlerFunction()));
  targets.forEach((t) => ScriptApp.deleteTrigger(t));
  return targets.length;
}
