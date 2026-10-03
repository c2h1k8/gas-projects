/**
 * 手順を1つずつ実行する進捗ダイアログ（StepDialogView.html）の処理側。
 *
 * メニューの処理を「手順」に分け、ダイアログが手順を1つずつ google.script.run で呼びます。
 * サーバー側の処理中に状態を書いてダイアログが読みに来る方式（LoadingUI）と違って、
 * ダイアログは手順の完了を待ってから次を呼ぶので、表示が実際の進み具合とずれません。
 * 手順ごとに別の実行になるので、全体が長くても1回の実行時間の上限（6分）に当たりにくくなります。
 *
 * LoadingUI との使い分け:
 *   - LoadingUI   … 1回の実行で終わり、手順を事前に並べられない処理（既存の処理を包むだけで使える）
 *   - StepDialog  … 手順が分かっている・時間が長い・確認や結果の表示が要る処理
 *
 * 使い方:
 *   プロジェクト側で STEP_DIALOG_ACTIONS（処理名 → 定義）をグローバルに定義し、StepDialog.open('処理名', args) で開く。
 *   定義は読み込み時ではなく呼ばれたときに参照するので、ファイルの読み込み順に左右されない。
 *
 *   STEP_DIALOG_ACTIONS = {
 *     処理名: {
 *       plan(args)            → { title, args?, steps: [{ id, label }], confirm?, error? }
 *       step(id, args, ctx)   → StepDialog.done(ctx, detail) / skipped(...) / failed(...)
 *                               （返り値に insert: [{ id, label }] を付けると、その手順の直後に手順を足せる）
 *       finish(args, ctx)     → { message, open?, results?, autoClose? }
 *       continueOnError       … 手順が失敗しても残りを続けるか（既定 false）
 *       lock                  … 'document'（既定）/ 'script' / false。手順ごとにこのロックを取る
 *       afterOpen(sheet)      … 結果の「開く」ボタンでシートを開いた後の処理（任意）
 *     },
 *   };
 *
 *   confirm: { message, choices: [{ label, args, steps?, primary?, danger? }] }
 *     選んだボタンの args を plan の args に重ね、steps があれば手順を差し替えて始める。
 *   results: [{ name, status: 'done'|'error'|'skipped', message, url? }] … 結果の表（月ごとの結果など）
 *   ctx: 手順の間で引き継ぐ値。ダイアログ経由で受け渡すので JSON にできる値だけを入れる。
 */
const StepDialog = (function () {
  const VIEW = 'StepDialogView';

  const actions_ = () => {
    if (typeof STEP_DIALOG_ACTIONS === 'undefined') throw new Error('STEP_DIALOG_ACTIONS が定義されていません');
    return STEP_DIALOG_ACTIONS; // eslint-disable-line no-undef
  };

  const action_ = (name) => {
    const action = actions_()[name];
    if (!action) throw new Error(`不明な処理です: ${name}`);
    return action;
  };

  const withLock_ = (kind, fn) => {
    if (kind === false) return fn();
    const lock = kind === 'script' ? LockService.getScriptLock() : LockService.getDocumentLock();
    if (!lock.tryLock(30000)) throw new Error('別の処理が実行中です。しばらく待ってから再実行してください。');
    try {
      return fn();
    } finally {
      lock.releaseLock();
    }
  };

  /** ダイアログを開きます。 */
  const open = (name, args = {}, opts = {}) => {
    const t = HtmlService.createTemplateFromFile(VIEW);
    t.boot = JSON.stringify({ action: name, args });
    SpreadsheetApp.getUi().showModalDialog(t.evaluate().setWidth(opts.width || 500).setHeight(opts.height || 560), ' ');
  };

  const plan = (name, args) => {
    const a = action_(name);
    return { continueOnError: !!a.continueOnError, ...a.plan(args || {}) };
  };

  const step = (name, id, args, ctx) => {
    const a = action_(name);
    return withLock_(a.lock === undefined ? 'document' : a.lock, () => a.step(id, args || {}, ctx || {}));
  };

  const finish = (name, args, ctx) => action_(name).finish(args || {}, ctx || {});

  const openSheet = (name, sheetName) => {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!sheet) return;
    sheet.activate();
    const a = action_(name);
    if (a.afterOpen) a.afterOpen(sheet);
  };

  // 手順の結果を作るヘルパー
  const done = (ctx, detail = '', extra = {}) => ({ ctx, status: 'done', detail, ...extra });
  const skipped = (ctx, detail = '', extra = {}) => ({ ctx, status: 'skipped', detail, ...extra });
  const failed = (ctx, detail = '', extra = {}) => ({ ctx, status: 'error', detail, ...extra });

  return { open, plan, step, finish, openSheet, done, skipped, failed };
})();

// ===== ダイアログから google.script.run で呼ぶ入口（末尾が _ の関数は呼べないので名前を分けている） =====

function stepDialogPlan(action, args) {
  return StepDialog.plan(action, args);
}

function stepDialogStep(action, id, args, ctx) {
  return StepDialog.step(action, id, args, ctx);
}

function stepDialogFinish(action, args, ctx) {
  return StepDialog.finish(action, args, ctx);
}

function stepDialogOpenSheet(action, sheetName) {
  return StepDialog.openSheet(action, sheetName);
}
