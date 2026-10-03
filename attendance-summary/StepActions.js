/**
 * 進捗ダイアログ（共通の StepDialog）で実行する処理の定義。
 *
 * サマリの更新を「準備 → 月ごとの読み込み → 書き込み」の手順に分けます。
 * 読み込む月は準備の手順で決まるので、準備の結果で月の数だけ手順を足します（insert）。
 * 月ごとの途中結果はスクリプトキャッシュに置き（SummaryService.stepStore）、手順の間で受け渡します。
 * ロックはトリガ（runRefresh_）と同じスクリプトロックを手順ごとに取ります。
 */
const STEP_DIALOG_ACTIONS = {
  refresh: {
    lock: 'script',
    plan: (a) => {
      const full = !!a.full;
      return {
        title: full ? '全期間を再集計' : 'サマリを更新',
        args: { full, runId: Utilities.getUuid() },
        steps: [
          { id: 'prepare', label: full ? '索引を作り直し、勤務表フォルダを調べる' : '設定と索引を確認' },
          { id: 'commit', label: '契約を反映してシートへ書き込む' },
        ],
      };
    },
    step: (id, args, ctx) => {
      const store = SummaryService.stepStore(args.runId);
      if (id === 'prepare') {
        const plan = SummaryService.prepare(args.full, store);
        ctx.plan = plan;
        const preRead = plan.months - plan.skipYms.length - plan.toRead.length;
        const parts = [`${plan.months}ヶ月のうち、読み込むのは${plan.toRead.length + preRead}ヶ月`];
        if (plan.scanned) parts.push(`フォルダを走査${preRead ? `（うち${preRead}ヶ月は走査で読み込み済み）` : ''}`);
        if (plan.skipYms.length) parts.push(`変更の無い${plan.skipYms.length}ヶ月はそのまま`);
        return StepDialog.done(ctx, parts.join(' / '), {
          insert: plan.toRead.map((m) => ({ id: `read:${m.ym}`, label: `${SummaryService.label(m.ym)} の勤務表を読み込む` })),
        });
      }
      if (id.startsWith('read:')) {
        const ym = id.slice('read:'.length);
        const item = ctx.plan.toRead.find((m) => m.ym === ym);
        return SummaryService.readOne(item, store) === 'read'
          ? StepDialog.done(ctx)
          : StepDialog.skipped(ctx, '開けない・勤務表として読めないため、前回の内容を残します');
      }
      if (id === 'commit') {
        ctx.result = SummaryService.commit(ctx.plan, store);
        return StepDialog.done(ctx, `${ctx.result.months}ヶ月をシートへ書き込みました`);
      }
      throw new Error(`不明な手順です: ${id}`);
    },
    finish: (args, ctx) => ({
      message: describe_(ctx.result),
      open: SheetLayout.SUMMARY_SHEET,
      // 契約が見つからない月があるときは、読み落とさないよう閉じずに残す
      autoClose: ctx.result.noContract === 0,
    }),
  },
};
