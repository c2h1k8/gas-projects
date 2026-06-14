/**
 * 勤怠Botの返信に使うFlexメッセージ（bubble）ビルダー群。
 * 値は呼び出し側で整形済みの文字列を渡す（このファイルは見た目の構築に専念）。
 */
const FlexCards = (() => {
  const BLUE = '#4A86E8';
  const DARK = '#333840';
  const GRAY = '#8A8F9A';
  const LIGHT = '#E4E7EE';

  // 勤怠区分 → アクセント色
  const TYPE_COLOR = {
    '出勤': '#26A65B',
    '休日出勤': '#6366D2',
    '欠勤': '#969CA8',
    '有給休暇': '#26B0AA',
    '代休': '#F59E42',
    'クリア': '#EB6978',
  };
  const colorOf = (type) => TYPE_COLOR[type] || BLUE;

  const text = (t, opt = {}) => Object.assign({ type: 'text', text: String(t) }, opt);
  const sep = (margin = 'md') => ({ type: 'separator', margin, color: LIGHT });

  // ラベル＋値の縦並び（KPI用）
  const metric = (label, value, color) => ({
    type: 'box', layout: 'vertical', spacing: 'none',
    contents: [
      text(label, { size: 'xs', color: GRAY, align: 'center' }),
      text(value, { size: 'lg', weight: 'bold', color: color || DARK, align: 'center' }),
    ],
  });

  // カラーヘッダー付きbubbleの枠
  const shell = (headerColor, headerContents, bodyContents) => ({
    type: 'bubble',
    header: {
      type: 'box', layout: 'horizontal', backgroundColor: headerColor,
      paddingAll: 'lg', contents: headerContents,
    },
    body: {
      type: 'box', layout: 'vertical', spacing: 'md', paddingAll: 'lg',
      contents: bodyContents,
    },
  });

  return {
    /**
     * 打刻結果カード。
     * @param {{dateLabel, type, start, end, kosu, summary}} p
     *   summary: { total, overtime, forecast } いずれも文字列（forecastはnull可）。summary自体null可。
     */
    punch: ({ dateLabel, type, start, end, kosu, summary }) => {
      const c = colorOf(type);
      const body = [];

      // 時刻フロー
      const times = [];
      if (start && start !== '-') times.push(`出社 ${start}`);
      if (end && end !== '-') times.push(`退社 ${end}`);
      if (times.length) {
        body.push(text(times.join('  →  '), { size: 'md', color: DARK, weight: 'bold', align: 'center' }));
      }
      // 工数（主役）
      if (kosu) {
        body.push({
          type: 'box', layout: 'vertical', spacing: 'none', margin: 'md',
          contents: [
            text('工数', { size: 'xs', color: GRAY, align: 'center' }),
            text(kosu, { size: '3xl', weight: 'bold', color: c, align: 'center' }),
          ],
        });
      }
      if (!times.length && !kosu) {
        body.push(text('登録しました', { size: 'md', color: DARK, align: 'center' }));
      }
      // 今月サマリ
      if (summary) {
        body.push(sep());
        const m = [metric('合計', summary.total, DARK), metric('残業', summary.overtime, c)];
        if (summary.forecast) m.push(metric('見込み', summary.forecast, GRAY));
        body.push({ type: 'box', layout: 'horizontal', margin: 'md', contents: m });
      }

      return shell(c, [
        text(type, { color: '#FFFFFF', weight: 'bold', size: 'lg', flex: 0 }),
        text(dateLabel, { color: '#FFFFFF', size: 'sm', align: 'end', gravity: 'center' }),
      ], body);
    },

    /**
     * 稼働一覧カード。
     * @param {{title, total, overtime, forecast, rows}} p
     *   rows: [{ dateLabel, type, time, kosu }]（稼働日のみ）
     */
    list: ({ title, total, overtime, forecast, rows }) => {
      const kpi = [metric('合計', total, DARK), metric('残業', overtime, BLUE)];
      if (forecast) kpi.push(metric('見込み', forecast, GRAY));

      const body = [
        { type: 'box', layout: 'horizontal', contents: kpi },
        sep(),
      ];
      if (!rows || rows.length === 0) {
        body.push(text('稼働なし', { size: 'sm', color: GRAY, align: 'center', margin: 'md' }));
      } else {
        for (const r of rows) {
          body.push({
            type: 'box', layout: 'horizontal', spacing: 'sm', margin: 'sm', alignItems: 'center',
            contents: [
              text('●', { size: 'sm', color: colorOf(r.type), flex: 0 }),
              text(r.dateLabel, { size: 'sm', color: DARK, flex: 3 }),
              text(r.time || r.type, { size: 'sm', color: GRAY, flex: 4 }),
              text(r.kosu || '-', { size: 'sm', color: DARK, align: 'end', flex: 2 }),
            ],
          });
        }
      }
      return shell(BLUE, [text(title, { color: '#FFFFFF', weight: 'bold', size: 'md' })], body);
    },

    /**
     * 結果カード（勤怠連絡・勤務表提出など）。
     * @param {{status, title, subtitle}} p  status: 'ok' | 'ng' | 'info'
     */
    result: ({ status, title, subtitle }) => {
      const map = { ok: ['#1DB446', '✓'], ng: ['#EB6978', '✕'], info: ['#8A8F9A', 'ℹ'] };
      const [color, icon] = map[status] || map.info;
      const body = [text(`${icon}  ${title}`, { weight: 'bold', size: 'md', color })];
      if (subtitle) body.push(text(subtitle, { size: 'sm', color: GRAY, margin: 'sm', wrap: true }));
      return {
        type: 'bubble',
        body: { type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: 'lg', contents: body },
      };
    },

    /**
     * ヘルプカード。
     * @param {Array<{cd, label}>} typeList 勤怠区分の一覧
     */
    help: (typeList) => {
      const section = (head, lines) => {
        const c = [text(head, { weight: 'bold', size: 'sm', color: BLUE })];
        lines.forEach((l) => c.push(text(l, { size: 'sm', color: DARK, wrap: true, margin: 'sm' })));
        return { type: 'box', layout: 'vertical', spacing: 'none', margin: 'md', contents: c };
      };
      const body = [
        text('使い方', { weight: 'bold', size: 'lg', color: DARK }),
        sep(),
        section('打刻（テキスト入力）', ['例) 1900 → 退社', '例) 1102 1931 → 出社・退社', '例) 1日 1900 / 1th 1900 → 日付指定']),
        section('勤怠区分（先頭に付与・出社は省略可）', typeList.map((t) => `${t.cd} : ${t.label}`)),
        section('勤怠連絡', ['例) 休 yyyymmdd 本文', '例) 客先休 yyyymmdd yyyymmdd 本文']),
        section('一覧', ['「リスト」… 当月', '「リスト 1」… 先月']),
      ];
      return {
        type: 'bubble',
        body: { type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: 'lg', contents: body },
      };
    },
  };
})();
