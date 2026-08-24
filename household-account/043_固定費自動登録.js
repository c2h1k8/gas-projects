/**
 * 固定費 自動登録。
 *
 * 設定は money 側（マスタ管理タブ = M_FIXED_COST）で管理する。GAS は日次トリガーで
 * **その日に登録すべきぶん**を GET し、money API へ「未確認」で登録して通知するだけ。
 *
 * 【判定は money 側】対象月・営業日/祝日補正・月末・有効期間・隔年・取りこぼしの追いつき・
 * 登録済み/スキップの除外は、すべて `GET /api/fixed-costs/due` が済ませて返す。
 * 以前はここで判定しており、祝日を Google Calendar API から引いていたため、日本の
 * 営業日カレンダーの実装が money（内閣府の公式データ）と GAS（Googleカレンダー）で
 * 2つに割れていた。祝日の扱いが食い違えば登録日が1日ずれる。
 *
 * 冪等化（出所タグ）: 生成する取引に fixed_cost_id ＋ fixed_cost_ym（発生月）を刻む。
 * money 側が (id, ym) の重複を弾く（多重防御）。取引日/金額を後から編集・翌月へ動かしても
 * 発生月YMは不変なので、翌月分は別途登録される。定義側に登録実績カラムは持たない
 * （T_SPENDING/T_INCOME が唯一の正）。
 */
const MainProcFixedCost = (function () {
  return {
    regist: () => {
      const dues = MoneyApi.getDueFixedCosts();
      if (!dues || !dues.length) {
        Logger.log('本日登録すべき固定費はありません。');
        return;
      }

      const items = [];
      for (const def of dues) {
        let uuid;
        switch (def.type) {
          case '収入':
            uuid = MoneyApi.registerIncome({
              name: def.title, date: def.dueDate, amount: def.amount,
              fixedCostId: def.id, fixedCostYm: def.ym,
            });
            break;
          case '支出':
            uuid = MoneyApi.registerSpending({
              name: def.title, date: def.dueDate, amount: def.amount,
              category: def.category, payee: def.payee, methodPay: def.methodPay,
              note: def.note, expenseRatio: def.expenseRatio,
              fixedCostId: def.id, fixedCostYm: def.ym,
            });
            break;
          default:
            continue;
        }

        if (uuid) {
          items.push({ title: def.title, amount: def.amount });
        }
      }

      if (items.length) {
        LocalUtils.postFlex('固定費を登録', NotifyCards.fixedCost(items));
      }
    },
    error: (e) => {
      if (e instanceof DbNotFoundException) {
        LocalUtils.postText(e.message);
        return;
      }
      throw e;
    },
  };
})();

/**
 * 固定費登録
 */
function CreateFixedCost() {
  try {
    MainProcFixedCost.regist();
  } catch (e) {
    MainProcFixedCost.error(e);
  }
}
