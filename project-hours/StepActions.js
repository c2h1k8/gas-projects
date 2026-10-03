/**
 * 進捗ダイアログ（共通の StepDialog）で実行する処理の定義。
 *
 * メニューの処理を手順に分けて書きます。ダイアログが手順を1つずつ呼ぶので、
 * 手順の一覧・進み具合・結果がそのまま画面に出ます（仕組みと書き方は common/StepDialog.js）。
 * 手順の間で引き継ぐ値は ctx（JSON にできる値だけ）に入れます。
 * ロックは StepDialog が手順ごとに取るので、ここでは取らない。
 */
const STEP_DIALOG_ACTIONS = (function () {
  const ss_ = () => SpreadsheetApp.getActiveSpreadsheet();

  const STEP = {
    base: { id: 'base', label: 'サマリ・案件マスタ・設定を確認' },
    month: (name) => ({ id: 'month', label: `${name} を作成（祝日の確認と書式の設定）` }),
    summary: { id: 'summary', label: 'サマリを更新' },
    backup: (name) => ({ id: 'backup', label: `${name} のバックアップを作成` }),
    remove: (name) => ({ id: 'remove', label: `今の ${name} を削除` }),
    cleanup: { id: 'cleanup', label: '空の「シート1」を削除' },
    reflect: (name) => ({ id: `reflect:${name}`, label: `${name} を報告シートへ書き込み` }),
  };

  // StepDialog は読み込み順によってはまだ無いので、呼ばれたときに参照する
  const done = (...a) => StepDialog.done(...a);
  const skipped = (...a) => StepDialog.skipped(...a);
  const failed = (...a) => StepDialog.failed(...a);

  /** 月シートを作る系の手順の実体（作成・作り直し・初期設定で共通） */
  const runMonthStep_ = (id, args, ctx) => {
    const ss = ss_();
    if (id === 'base') {
      SummarySheet.ensure(ss);
      MasterSheet.ensure(ss);
      SettingsSheet.ensure(ss);
      return done(ctx);
    }
    if (id === 'month') {
      const { created } = MonthSheet.ensure(ss, MonthSheet.dateOf(args.month));
      ctx.created = created;
      return created ? done(ctx) : skipped(ctx, '作成済みのため何もしません');
    }
    if (id === 'summary') {
      if (!ctx.created && !args.forceSummary) return skipped(ctx, 'シートを作っていないため不要');
      SummarySheet.rebuild(ss);
      return done(ctx);
    }
    if (id === 'backup') {
      const sheet = ss.getSheetByName(args.month);
      ctx.backup = backupSheet_(ss, sheet).getName();
      return done(ctx, ctx.backup);
    }
    if (id === 'remove') {
      const sheet = ss.getSheetByName(args.month);
      if (sheet) ss.deleteSheet(sheet);
      return done(ctx);
    }
    if (id === 'cleanup') {
      const blank = ss.getSheetByName('シート1') || ss.getSheetByName('Sheet1');
      if (!blank || blank.getLastRow() > 0 || blank.getLastColumn() > 0) return skipped(ctx, '空のシートは無し');
      ss.deleteSheet(blank);
      return done(ctx);
    }
    throw new Error(`不明な手順です: ${id}`);
  };

  /** 月シートの作成結果（作ったシートを開くボタンを出す） */
  const finishMonth_ = (verb) => (args, ctx) => ({
    message: ctx.created ? `${args.month} を${verb}しました` : `${args.month} は作成済みです`,
    open: args.month,
    autoClose: true,
  });

  /** 処理ごとの定義（書き方は common/StepDialog.js）。報告シートは月ごとに独立しているので失敗しても続ける */
  const ACTIONS = {
    createMonth: {
      plan: (a) => {
        const now = new Date();
        const month = MonthSheet.nameOf(new Date(now.getFullYear(), now.getMonth() + (a.offset || 0), 1));
        return { title: `${month} を作成`, args: { month }, steps: [STEP.base, STEP.month(month), STEP.summary] };
      },
      step: runMonthStep_,
      finish: finishMonth_('作成'),
    },

    recreateMonth: {
      plan: () => {
        const month = MonthSheet.nameOf(new Date());
        const exists = !!ss_().getSheetByName(month);
        const plan = {
          title: `${month} を作り直す`,
          args: { month, backup: false },
          steps: [STEP.base, STEP.month(month), STEP.summary],
        };
        if (!exists) return plan;
        // 確認で選んだボタンの args で手順を組み直すので、手順は選択肢ごとに持つ
        const steps = (backup) => [STEP.base, ...(backup ? [STEP.backup(month)] : []), STEP.remove(month), STEP.month(month), STEP.summary];
        plan.steps = steps(true); // 選ぶ前は「残して作り直す」の手順を見せておく
        plan.confirm = {
          message: `${month} を、今のレイアウトと設定シートの内容（入力単位・案件の選び方・刻み）で作り直します。`
            + '入力済みの工数・備考は新しいシートには引き継がれません。',
          choices: [
            { label: 'バックアップを残して作り直す', args: { backup: true }, steps: steps(true), primary: true },
            { label: '残さずに作り直す', args: { backup: false }, steps: steps(false), danger: true },
          ],
        };
        return plan;
      },
      step: runMonthStep_,
      finish: (args, ctx) => ({
        message: `${args.month} を作り直しました${ctx.backup ? `（バックアップ: ${ctx.backup}）` : ''}`,
        open: args.month,
        autoClose: !ctx.backup,
      }),
    },

    setup: {
      plan: () => {
        const month = MonthSheet.nameOf(new Date());
        return { title: '初期設定', args: { month }, steps: [STEP.base, STEP.month(month), STEP.summary, STEP.cleanup] };
      },
      step: runMonthStep_,
      finish: () => ({ message: 'シートを用意しました。案件マスタに案件を登録してください。', open: Layout.MASTER_SHEET }),
    },

    rebuildSummary: {
      plan: () => ({ title: 'サマリを更新', args: { forceSummary: true }, steps: [STEP.summary] }),
      step: runMonthStep_,
      finish: () => ({ message: 'サマリを更新しました', open: Layout.SUMMARY_SHEET, autoClose: true }),
    },

    reflect: {
      continueOnError: true,
      plan: (a) => {
        const ss = ss_();
        let sheets;
        if (a.mode === 'active') {
          const sheet = ss.getActiveSheet();
          if (!Layout.MONTH_SHEET_PATTERN.test(sheet.getName())) {
            return { title: '報告シートへ反映', error: '反映したい月のシートを開いてから実行してください。' };
          }
          sheets = [sheet];
        } else {
          sheets = ReportExporter.targetsForToday(ss);
        }
        if (!sheets.length) return { title: '報告シートへ反映', error: '反映する月シートがありません。' };
        try {
          SettingsSheet.readReport(ss); // 設定の不備は書き始める前に止める
        } catch (e) {
          return { title: '報告シートへ反映', error: e.message };
        }
        const names = sheets.map((s) => s.getName());
        return { title: '報告シートへ反映', args: { months: names }, steps: names.map((n) => STEP.reflect(n)) };
      },
      step: (id, args, ctx) => {
        const name = id.replace(/^reflect:/, '');
        const sheet = ss_().getSheetByName(name);
        if (!sheet) return failed(ctx, `${name} シートがありません`);
        const used = new Map(Object.entries(ctx.used || {}));
        const r = ReportExporter.run(ss_(), [sheet], used)[0];
        ctx.used = Object.fromEntries(used);
        ctx.results = [...(ctx.results || []), r];
        if (r.skipped) return skipped(ctx, r.message);
        return r.ok ? done(ctx, r.message) : failed(ctx, r.message);
      },
      finish: (args, ctx) => {
        const results = (ctx.results || []).map((r) => ({
          name: r.name,
          status: r.skipped ? 'skipped' : (r.ok ? 'done' : 'error'),
          message: r.message,
          url: r.fileId ? `https://docs.google.com/spreadsheets/d/${r.fileId}/edit` : null,
        }));
        const ng = results.filter((r) => r.status === 'error').length;
        return { message: ng ? `${ng}件の月で失敗しました` : '報告シートへ反映しました', results };
      },
    },
  };

  // 結果の「開く」ボタンで月シートを開いたら、今日の行を選択する
  Object.values(ACTIONS).forEach((action) => { action.afterOpen = (sheet) => MonthSheet.focusToday(sheet); });

  return ACTIONS;
})();
