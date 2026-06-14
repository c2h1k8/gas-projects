/**
 * 家計簿のプッシュ通知用 Flexメッセージ（bubble）ビルダー。
 * 値は呼び出し側で用意し、ここは見た目の構築に専念する。
 */
const NotifyCards = (() => {
  const GREEN = '#1DB446';
  const ORANGE = '#F59E42';
  const RED = '#EB6978';
  const GRAY = '#8A8F9A';
  const DARK = '#333840';
  const LIGHT = '#E4E7EE';

  const text = (t, opt = {}) => Object.assign({ type: 'text', text: String(t) }, opt);
  const sep = (m = 'md') => ({ type: 'separator', margin: m, color: LIGHT });
  const yen = (n) => `¥${Number(n || 0).toLocaleString()}`;

  const shell = (headerColor, headerText, bodyContents) => ({
    type: 'bubble',
    header: {
      type: 'box', layout: 'horizontal', backgroundColor: headerColor, paddingAll: 'lg',
      contents: [text(headerText, { color: '#FFFFFF', weight: 'bold', size: 'md', wrap: true })],
    },
    body: { type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: 'lg', contents: bodyContents },
  });

  // 左ラベル＋金額（右寄せ強調）の1行
  const moneyRow = (left, amount, color) => ({
    type: 'box', layout: 'horizontal', alignItems: 'center',
    contents: [
      text(left, { size: 'sm', color: DARK, flex: 5, wrap: true }),
      text(yen(amount), { size: 'sm', color: color || DARK, weight: 'bold', align: 'end', flex: 3 }),
    ],
  });

  // 明細（主行＋サブ行）
  const entry = (main, amount, sub, color) => {
    const c = [moneyRow(main, amount, color)];
    if (sub) c.push(text(sub, { size: 'xs', color: GRAY, wrap: true }));
    return { type: 'box', layout: 'vertical', spacing: 'none', margin: 'md', contents: c };
  };

  return {
    /**
     * タスク通知。
     * @param {{overdue, dueToday, allDone, afternoon}} p  overdue/dueToday は文字列配列
     */
    tasks: ({ overdue, dueToday, allDone, afternoon }) => {
      if (allDone) {
        return {
          type: 'bubble',
          body: {
            type: 'box', layout: 'vertical', paddingAll: 'lg', spacing: 'sm',
            contents: [text(`✓ ${afternoon ? '本日もお疲れ様でした' : '未完了タスクなし'}`, { weight: 'bold', size: 'md', color: GREEN, wrap: true })],
          },
        };
      }
      const body = [];
      const section = (title, color, items) => {
        body.push(text(title, { weight: 'bold', size: 'sm', color, margin: body.length ? 'md' : 'none' }));
        items.forEach((t) => body.push(text(`• ${t}`, { size: 'sm', color: DARK, wrap: true, margin: 'sm' })));
      };
      if (overdue && overdue.length) section('期限切れ', RED, overdue);
      if (dueToday && dueToday.length) section('本日まで', afternoon ? RED : ORANGE, dueToday);
      const headColor = (overdue && overdue.length) ? RED : ORANGE;
      return shell(headColor, 'タスク', body);
    },

    /**
     * 家計簿 未登録通知。
     * @param {Array<{date, amount, sub}>} rows
     */
    unregistered: (rows) => {
      const body = [];
      rows.forEach((r, i) => {
        if (i > 0) body.push(sep('sm'));
        body.push(entry(r.date, r.amount, r.sub, ORANGE));
      });
      return shell(ORANGE, `家計簿 未登録（${rows.length}件）`, body);
    },

    /**
     * 固定費 自動登録。
     * @param {Array<{title, amount}>} rows
     */
    fixedCost: (rows) => {
      const total = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
      const body = rows.map((r) => moneyRow(r.title, r.amount));
      body.push(sep());
      body.push(moneyRow('合計', total, GREEN));
      return shell(GREEN, `固定費を登録（${rows.length}件）`, body);
    },

    /**
     * メール自動登録 結果（1カード集約）。
     * @param {{success, skip, fail}} p  各 [{label, amount, sub}]
     */
    mailResult: ({ success, skip, fail }) => {
      const body = [];
      const group = (title, color, items) => {
        if (!items || !items.length) return;
        body.push(text(title, { weight: 'bold', size: 'sm', color, margin: body.length ? 'md' : 'none' }));
        items.forEach((it) => body.push(entry(it.label, it.amount, it.sub, color)));
      };
      group('登録', GREEN, success);
      group('スキップ', GRAY, skip);
      group('失敗', RED, fail);
      const headColor = (fail && fail.length) ? RED : (success && success.length) ? GREEN : GRAY;
      return shell(headColor, 'メールから登録', body);
    },
  };
})();
