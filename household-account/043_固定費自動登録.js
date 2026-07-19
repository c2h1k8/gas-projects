/**
 * 固定費 自動登録。
 *
 * 【方針転換】設定はスプレッドシートではなく money 側（マスタ管理タブ = M_FIXED_COST）で
 * 管理する。GAS は日次トリガーで定義を GET し、対象日に money API へ「未確認」で登録する。
 * 判定（対象月・営業日/祝日補正・月末・有効期間・隔年）と通知はここに残す。
 *
 * 冪等化（出所タグ）: 生成する取引に fixed_cost_id ＋ fixed_cost_ym（発生月）を刻む。GET が返す
 * def.posted{発生月YM:登録日} で既登録月はスキップ（通知の重複も防ぐ）、money 側も (id, ym) の
 * 重複を弾く（多重防御）。取引日/金額を後から編集・翌月へ動かしても発生月YMは不変なので、
 * 翌月分は別途登録される。定義側に登録実績カラムは持たない（T_SPENDING/T_INCOME が唯一の正）。
 * 取りこぼしは予定日〜数日（CATCHUP_DAYS）内なら追いつく。
 *
 * 定義フィールド（GET /api/fixed-costs）:
 *   id, enabled, type('支出'|'収入'), title, amount, category, payee, methodPay, note, expenseRatio,
 *   months(''=毎月 / '1,7' / '1,3,5,7,9,11'), day(1-31, 0=月末),
 *   bizAdjust('none'|'prev'|'next'), yearInterval(1=毎年,2=隔年…), yearAnchor(基準年|null),
 *   validFrom/validTo('YYYY-MM'|''), posted({発生月YM:登録日})
 */
const MainProcFixedCost = (function () {

  // 取りこぼしの追いつき猶予（日）。予定日にトリガーが落ちても数日内なら登録する。
  // 広げすぎると「月途中で追加した定義がその月に遡って登録される」誤爆になるため短めに。
  const CATCHUP_DAYS = 3;

  // 対象月 csv を数値配列へ。空=毎月(null)。
  const parseMonths_ = (raw) => {
    if (raw === null || raw === undefined || raw === '') return null;
    if (typeof raw === 'number') return [raw];
    const arr = String(raw).split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => n >= 1 && n <= 12);
    return arr.length ? arr : null;
  };

  // 隔年ゲート: yearInterval>1 のとき (year - anchor) % interval === 0 の年だけ対象。
  const isYearDue_ = (def, year) => {
    const interval = Number(def.yearInterval) || 1;
    if (interval <= 1) return true;
    const anchor = def.yearAnchor;
    if (anchor === null || anchor === undefined || anchor === '') return true;
    return (((year - Number(anchor)) % interval) + interval) % interval === 0;
  };

  const pad2_ = (n) => String(n).padStart(2, '0');

  /**
   * この定義が今日「登録すべき予定日」を返す（対象外なら null）。
   * 営業日補正で月をまたぐケース（例: 3/1(祝)→2/28、2/末(土)→翌月頭）も候補月で吸収。
   * 予定日 D が今月内で、今日が D 以降なら D を返す（取りこぼしの当月内追いつき）。
   */
  const dueDate_ = (def, now) => {
    const months = parseMonths_(def.months);
    const bizAdjust = def.bizAdjust || 'none';

    // 候補となる「名目月」（now基準の相対index）。営業日補正の月またぎを考慮。
    const candidates = [now.getMonth()];
    if (bizAdjust === 'next') candidates.push(now.getMonth() - 1); // 前月の予定が後営業日で今月に来る
    if (bizAdjust === 'prev') candidates.push(now.getMonth() + 1); // 翌月の予定が前営業日で今月に来る

    for (const relMonth of candidates) {
      const base = new Date(now.getFullYear(), relMonth, 1); // -1/12 は自動で年繰り上げ/下げ
      const y = base.getFullYear();
      const m0 = base.getMonth();          // 0-11
      const nominalMonth = m0 + 1;         // 1-12

      if (months && !months.includes(nominalMonth)) continue;
      if (!isYearDue_(def, y)) continue;

      const ym = `${y}-${pad2_(nominalMonth)}`;
      if (def.validFrom && ym < def.validFrom) continue;
      if (def.validTo && ym > def.validTo) continue;

      // 予定日 D（0=月末、存在しない日は月末へ丸め）
      let D;
      if (Number(def.day) === 0) {
        D = new Date(y, m0 + 1, 0);
      } else {
        D = new Date(y, m0, Number(def.day));
        if (D.getMonth() !== m0) D = new Date(y, m0 + 1, 0);
      }
      if (bizAdjust === 'prev') D = DateUtils.getBizDatePrev(D);
      else if (bizAdjust === 'next') D = DateUtils.getBizDateNext(D);

      // 今日が予定日 D、または D の CATCHUP_DAYS 日後まで（同月内）なら登録対象。
      // 冪等化（発生月タグ）と併せ、トリガー落ちを数日内で1回だけ追いつく。
      // ym は「発生月」＝出所タグ FIXED_COST_YM に刻む（予定日Dの暦月ではなく名目月）。
      if (D.getFullYear() === now.getFullYear()
        && D.getMonth() === now.getMonth()) {
        const diff = now.getDate() - D.getDate();
        if (diff >= 0 && diff <= CATCHUP_DAYS) return { date: D, ym: ym };
      }
    }
    return null;
  };

  return {
    regist: () => {
      const defs = MoneyApi.getFixedCosts();
      if (!defs || !defs.length) {
        Logger.log('固定費定義がありません。');
        return;
      }

      const now = new Date();
      const items = [];

      for (const def of defs) {
        if (!def.enabled) continue;

        const due = dueDate_(def, now);
        if (!due) {
          Logger.log(`対象外: ${def.title}`);
          continue;
        }

        // 冪等化（出所タグ）: この定義がその発生月に既に登録済みなら投げない＝通知の重複も防ぐ。
        // posted は GET /api/fixed-costs が返す {発生月YM: 登録日}。money 側も (id, ym) 重複を弾く（多重防御）。
        if (def.posted && def.posted[due.ym]) {
          Logger.log(`既登録につきスキップ: ${def.title} ${due.ym}`);
          continue;
        }

        let uuid;
        switch (def.type) {
          case '収入':
            uuid = MoneyApi.registerIncome({
              name: def.title, date: due.date, amount: def.amount,
              fixedCostId: def.id, fixedCostYm: due.ym,
            });
            break;
          case '支出':
            uuid = MoneyApi.registerSpending({
              name: def.title, date: due.date, amount: def.amount,
              category: def.category, payee: def.payee, methodPay: def.methodPay,
              note: def.note, expenseRatio: def.expenseRatio,
              fixedCostId: def.id, fixedCostYm: due.ym,
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
