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

  // FX の約定1件の行（▲買 1 Lot @157.834 と注文番号）
  const fxRow = (f, color) => ({
    type: 'box', layout: 'vertical', spacing: 'none', margin: 'md',
    contents: [
      { type: 'box', layout: 'horizontal', contents: [
        text(`${f.directionCd === '001' ? '▲買' : '▼売'} ${f.lot} Lot`, { size: 'sm', color: color || DARK, weight: 'bold', flex: 4 }),
        text(`@${Number(f.price).toFixed(3)}`, { size: 'sm', color: DARK, align: 'end', flex: 4 }),
      ] },
      text(`${f.pair}・${String(f.tradeDate).slice(5, 16)}・${f.orderNum}`, { size: 'xs', color: GRAY, wrap: true }),
    ],
  });

  return {
    /**
     * FX の約定メールの登録結果（1カード集約）。
     * 確認待ち＝新規か決済かが決まらない約定（反対の売買の建玉がある）。money の画面で振り分ける。
     * @param {{entry, pending, fail}} r 各 [{pair, directionCd, lot, price, orderNum, tradeDate}]
     * @param {string|null} url ポジション照会の URL
     */
    fxFillResult: ({ entry, pending, fail }, url) => {
      const body = [];
      const group = (title, color, items, note) => {
        if (!items || !items.length) return;
        body.push(text(title, { weight: 'bold', size: 'sm', color, margin: body.length ? 'lg' : 'none' }));
        if (note) body.push(text(note, { size: 'xs', color: GRAY, wrap: true }));
        items.forEach((f) => body.push(fxRow(f, color)));
      };
      group('確認待ち', ORANGE, pending, '新規か決済かを画面で選んでください');
      group('新規の建玉', GREEN, entry);
      group('失敗', RED, fail);
      const head = (fail && fail.length) ? RED : (pending && pending.length) ? ORANGE : GREEN;
      const card = shell(head, 'FX の約定', body);
      if (url && pending && pending.length) {
        card.footer = { type: 'box', layout: 'vertical', contents: [
          { type: 'button', style: 'link', height: 'sm', action: { type: 'uri', label: '振り分ける', uri: url } },
        ] };
      }
      return card;
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
