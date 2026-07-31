/**
 * 勤怠Botの返信に使うFlexメッセージ（bubble）ビルダー群。
 * 値は呼び出し側で整形済みの文字列を渡す（このファイルは見た目の構築に専念）。
 */
const FlexCards = (() => {
  const BLUE = '#4A86E8';
  const DARK = '#333840';
  const GRAY = '#8A8F9A';
  const LIGHT = '#E4E7EE';
  const WARN = '#EB6978';

  // 勤怠区分 → アクセント色
  const TYPE_COLOR = {
    '出勤': '#26A65B',
    '休日出勤': '#6366D2',
    '欠勤': '#EB6978',
    '有給休暇': '#26B0AA',
    '代休': '#F59E42',
    'クリア': '#EB6978',
  };
  const colorOf = (type) => TYPE_COLOR[type] || BLUE;

  // 予約一覧カードに並べる最大件数（超過分は件数のみ表示）
  const MAX_RESERVATION_ROWS = 15;

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
     *   summary: { total, overtime, forecast } いずれも文字列でnull可（nullの項目は出さない）。summary自体null可。
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
      // 今月サマリ（未来月は実績が無いため合計・残業がnullで、見込みだけになる）
      if (summary) {
        const m = [];
        if (summary.total) m.push(metric('合計', summary.total, DARK));
        if (summary.overtime) m.push(metric('残業', summary.overtime, c));
        if (summary.forecast) m.push(metric('見込み', summary.forecast, GRAY));
        if (m.length) {
          body.push(sep());
          body.push({ type: 'box', layout: 'horizontal', margin: 'md', contents: m });
        }
      }

      return shell(c, [
        text(type, { color: '#FFFFFF', weight: 'bold', size: 'lg', flex: 0 }),
        text(dateLabel, { color: '#FFFFFF', size: 'sm', align: 'end', gravity: 'center' }),
      ], body);
    },

    /**
     * 稼働一覧カード。
     * @param {{title, total, overtime, forecast, days, rows}} p
     *   days: 日数サマリー [{ label, count, type }]（type=勤怠区分。数字を種別色で表示）。省略可。
     *   rows: [{ dateLabel, type, time, kosu }]（稼働日のみ）
     */
    list: ({ title, total, overtime, forecast, days, rows }) => {
      const kpi = [metric('合計', total, DARK), metric('残業', overtime, BLUE)];
      if (forecast) kpi.push(metric('見込み', forecast, GRAY));

      const body = [{ type: 'box', layout: 'horizontal', contents: kpi }];
      if (days && days.length) {
        const spans = [];
        days.forEach((d, i) => {
          if (i > 0) spans.push({ type: 'span', text: '  ・  ', color: GRAY });
          spans.push({ type: 'span', text: `${d.label} `, color: GRAY });
          spans.push({ type: 'span', text: String(d.count), color: colorOf(d.type), weight: 'bold' });
          spans.push({ type: 'span', text: '日', color: GRAY });
        });
        body.push({ type: 'text', size: 'sm', align: 'center', margin: 'md', wrap: true, contents: spans });
      }
      body.push(sep());
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
     * 月別推移カード（過去Nヶ月の稼働をバーで可視化＋年間集計）。
     * @param {{title, rows, footer}} p
     *   rows: [{ label, total, overtime, current, barPct, days:[{type,count}], deltaText, alert }]
     *   footer: { yearTotal, monthAvg, dayAvg, overtimeRate, overtimeTotal, stdDiff, paidTotal, absentTotal } 省略可
     */
    history: ({ title, rows, footer }) => {
      const body = [];
      if (!rows || rows.length === 0) {
        body.push(text('データがありません', { size: 'sm', color: GRAY, align: 'center' }));
        return shell(BLUE, [text(title, { color: '#FFFFFF', weight: 'bold', size: 'md' })], body);
      }

      // 横バー（総稼働の相対量）。flex:1 で残りの幅をすべて使い、左右テキストは内容幅(flex:0)。
      // 当月は青、過去月は淡い青。
      const bar = (pct, current) => ({
        type: 'box', layout: 'horizontal', height: '8px', flex: 1, margin: 'md',
        backgroundColor: LIGHT, cornerRadius: '4px',
        contents: [{
          type: 'box', layout: 'vertical', width: `${pct}%`,
          backgroundColor: current ? BLUE : '#B6C6EA', cornerRadius: '4px', contents: [],
        }],
      });

      // 左右の列は全行で幅を固定（最大桁数基準）。中央のバー／バッジが残りを埋める＝全行で揃う。
      const LEFT_W = '96px';   // "残業 168:30 ⚠" が収まる幅
      const RIGHT_W = '64px';  // "↑+168:30" が収まる幅
      const leftCell = (node) => ({ type: 'box', layout: 'vertical', width: LEFT_W, flex: 0, contents: [node] });
      const rightCell = (node) => ({ type: 'box', layout: 'vertical', width: RIGHT_W, flex: 0, contents: [node] });

      rows.forEach((r, i) => {
        // 休暇バッジ（バーの下・中央。左右が固定幅なのでバー帯の真下に揃う）
        const badges = (r.days || []).map((d, j) => text(`${d.type.charAt(0)}${d.count}`, {
          size: 'xs', color: colorOf(d.type), margin: j > 0 ? 'sm' : 'none', flex: 0,
        }));

        body.push({
          type: 'box', layout: 'vertical', spacing: 'xs', margin: i > 0 ? 'lg' : 'none',
          contents: [
            {
              // 1行目：月度（固定幅） / バー（可変） / 総稼働（固定幅・右）
              type: 'box', layout: 'horizontal', alignItems: 'center',
              contents: [
                leftCell(text(r.label, { size: 'sm', weight: r.current ? 'bold' : 'regular', color: r.current ? BLUE : DARK })),
                bar(r.barPct, r.current),
                rightCell(text(r.total, { size: 'sm', weight: r.current ? 'bold' : 'regular', color: DARK, align: 'end' })),
              ],
            },
            {
              // 2行目：残業（固定幅） / 休暇バッジ（可変・中央） / 前月比（固定幅・右）
              type: 'box', layout: 'horizontal', alignItems: 'center',
              contents: [
                leftCell(text(`残業 ${r.overtime}${r.alert ? ' ⚠' : ''}`, { size: 'xs', color: r.alert ? WARN : GRAY, weight: r.alert ? 'bold' : 'regular' })),
                { type: 'box', layout: 'horizontal', flex: 1, margin: 'md', justifyContent: 'center', contents: badges.length ? badges : [text(' ', { size: 'xs' })] },
                rightCell(text(r.deltaText || ' ', { size: 'xs', color: GRAY, align: 'end' })),
              ],
            },
          ],
        });
      });

      if (footer) {
        body.push(sep('lg'));
        const cell = (label, value, accent) => ({
          type: 'box', layout: 'baseline', flex: 1,
          contents: [
            text(label, { size: 'xs', color: GRAY, flex: 0 }),
            text(value, { size: 'sm', weight: 'bold', color: accent ? BLUE : DARK, align: 'end', margin: 'sm' }),
          ],
        });
        body.push({ type: 'box', layout: 'horizontal', spacing: 'lg', contents: [cell('年間', footer.yearTotal, true), cell('月平均', footer.monthAvg)] });
        body.push({ type: 'box', layout: 'horizontal', spacing: 'lg', contents: [cell('1日平均', footer.dayAvg), cell('残業率', footer.overtimeRate)] });
        body.push({ type: 'box', layout: 'horizontal', spacing: 'lg', contents: [cell('残業計', footer.overtimeTotal), cell('所定差', footer.stdDiff)] });
        body.push({ type: 'box', layout: 'horizontal', spacing: 'lg', contents: [cell('有給計', footer.paidTotal), cell('欠勤計', footer.absentTotal)] });
      }

      return shell(BLUE, [text(title, { color: '#FFFFFF', weight: 'bold', size: 'md' })], body);
    },

    /**
     * 稼働サマリーカード（週次/月中/前月確定）。
     * @param {{title, subtitle, metrics, note}} p
     *   metrics: [{ label, value, accent }]（accent=trueでアクセント色）
     *   subtitle / note は省略可。
     */
    summary: ({ title, subtitle, metrics, note }) => {
      const body = [];
      if (subtitle) body.push(text(subtitle, { size: 'sm', color: GRAY, align: 'center' }));
      body.push({
        type: 'box', layout: 'horizontal', margin: subtitle ? 'md' : 'none',
        contents: (metrics || []).map((m) => metric(m.label, m.value, m.accent ? BLUE : DARK)),
      });
      if (note) {
        body.push(sep());
        body.push(text(note, { size: 'xs', color: GRAY, align: 'center', wrap: true }));
      }
      return shell(BLUE, [text(title, { color: '#FFFFFF', weight: 'bold', size: 'md' })], body);
    },

    /**
     * 結果カード（勤務表提出など）。
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
     * 勤怠漏れ通知カード。
     * @param {{title, sections}} p  sections: [{ label, dates: string[] }]
     */
    omission: ({ title, sections }) => {
      const body = [];
      (sections || []).forEach((s, i) => {
        body.push(text(s.label, { weight: 'bold', size: 'sm', color: WARN, margin: i > 0 ? 'lg' : 'none' }));
        (s.dates || []).forEach((d) => body.push(text(`・ ${d}`, { size: 'sm', color: DARK, margin: 'sm', wrap: true })));
      });
      return shell(WARN, [text(title, { color: '#FFFFFF', weight: 'bold', size: 'md' })], body);
    },

    /**
     * 未登録一覧カード（日ごとに出社/退社を個別入力するボタン付き）。
     * ボタンは時刻ピッカーを直接開き、初期値には現在の勤務表の値を使う。
     * @param {{title, subtitle, note, entries, single}} p
     *   entries: [{ dateStr, label, start, end, needStart, needEnd }]
     *   note: 直前の登録結果（省略可）
     *   single: 1日単位のカード（登録後も同じ1日カードへ戻る）
     */
    unregistered: ({ title, subtitle, note, entries, single }) => {
      // 未登録の側は強調、登録済みの側は現在時刻をラベルにした控えめな見た目にする
      const pickerButton = (dateStr, field, label, time, need) => {
        const data = { action: 'fill-punch', date: dateStr, field };
        if (single) data.single = 1;
        const button = {
          type: 'button', height: 'sm', flex: 1,
          style: need ? 'primary' : 'secondary',
          action: {
            type: 'datetimepicker',
            label: need ? `${label}を入力` : `${label} ${time}`,
            data: JSON.stringify(data),
            mode: 'time',
            initial: time,
            min: '00:00',
            max: '23:59',
          },
        };
        if (need) button.color = BLUE;
        return button;
      };

      const body = [];
      if (note) body.push(text(note, { size: 'xs', color: GRAY, align: 'center', wrap: true }));
      if (subtitle) body.push(text(subtitle, { size: 'sm', color: GRAY, align: 'center' }));
      body.push(sep());
      entries.forEach((e, i) => {
        const lack = (e.needStart && e.needEnd) ? '出社・退社が未登録'
          : (e.needStart ? '出社が未登録' : '退社が未登録');
        body.push({
          type: 'box', layout: 'horizontal', margin: i > 0 ? 'lg' : 'md', alignItems: 'center',
          contents: [
            text(e.label, { size: 'sm', color: DARK, weight: 'bold', flex: 4 }),
            text(lack, { size: 'xs', color: WARN, align: 'end', flex: 6 }),
          ],
        });
        body.push({
          type: 'box', layout: 'horizontal', spacing: 'sm', margin: 'sm',
          contents: [
            pickerButton(e.dateStr, 'start', '出社', e.start, e.needStart),
            pickerButton(e.dateStr, 'end', '退社', e.end, e.needEnd),
          ],
        });
      });
      return shell(WARN, [text(title, { color: '#FFFFFF', weight: 'bold', size: 'md' })], body);
    },

    /**
     * 休暇の予約一覧カード（月ごとの見出し・日付単位の取消・カレンダーからの追加）。
     * @param {{title, note, entries, addTypes}} p
     *   entries: [{ dateStr, monthLabel, label, type }]（日付昇順）。空なら未予約の案内を出す。
     *   addTypes: 予約を追加できる勤怠区分の配列（カレンダーを開くボタンになる）
     */
    reservations: ({ title, note, entries, addTypes }) => {
      const body = [];
      if (note) body.push(text(note, { size: 'xs', color: GRAY, align: 'center', wrap: true }));

      if (entries.length) {
        body.push(text('勤務表を作成したときに自動で反映されます', { size: 'xs', color: GRAY, align: 'center', wrap: true }));
        body.push(sep());
        let curMonth = '';
        // bubbleは縦に伸びると末尾が切れるため、件数が多い場合は先頭のみ表示する
        entries.slice(0, MAX_RESERVATION_ROWS).forEach((e) => {
          if (e.monthLabel !== curMonth) {
            curMonth = e.monthLabel;
            body.push(text(curMonth, { size: 'sm', weight: 'bold', color: BLUE, margin: 'lg' }));
          }
          body.push({
            type: 'box', layout: 'horizontal', margin: 'sm', alignItems: 'center', spacing: 'sm',
            contents: [
              text(e.label, { size: 'sm', color: DARK, weight: 'bold', flex: 4 }),
              text(e.type, { size: 'sm', color: colorOf(e.type), weight: 'bold', flex: 4 }),
              {
                type: 'button', height: 'sm', style: 'secondary', flex: 3,
                action: {
                  type: 'postback', label: '取消',
                  data: JSON.stringify({ action: 'cancel-reservation', date: e.dateStr }),
                },
              },
            ],
          });
        });
        if (entries.length > MAX_RESERVATION_ROWS) {
          body.push(text(`… 他 ${entries.length - MAX_RESERVATION_ROWS}件`, { size: 'xs', color: GRAY, align: 'end', margin: 'md' }));
        }
      } else {
        body.push(text('予約はありません', { size: 'md', color: DARK, weight: 'bold', align: 'center' }));
        body.push(text('勤務表が未作成の月の休みを、先に登録しておけます', { size: 'xs', color: GRAY, align: 'center', wrap: true }));
      }

      (addTypes || []).forEach((t, i) => {
        if (i === 0) body.push(sep('lg'));
        body.push({
          type: 'button', height: 'sm', style: 'secondary', margin: 'sm',
          action: {
            type: 'datetimepicker', label: `${t}を予約`, mode: 'date',
            data: JSON.stringify({ action: 'calendar', type: t }),
          },
        });
      });

      return shell(BLUE, [text(title, { color: '#FFFFFF', weight: 'bold', size: 'md' })], body);
    },

    /**
     * リンクカード（URIボタン）。勤務表を直接開く等に使用。
     * @param {{title, subtitle, url, label}} p
     */
    link: ({ title, subtitle, url, label }) => {
      const body = [];
      if (subtitle) body.push(text(subtitle, { size: 'sm', color: GRAY, wrap: true }));
      body.push({
        type: 'button', style: 'primary', height: 'sm', color: BLUE, margin: 'md',
        action: { type: 'uri', label: label || '開く', uri: url },
      });
      return shell(BLUE, [text(title, { color: '#FFFFFF', weight: 'bold', size: 'md' })], body);
    },

    /**
     * ヘルプカード。
     * @param {Array<{cd, label}>} typeList 勤怠区分の一覧
     */
    help: (typeList) => {
      // 見出し＋説明行のセクション（行は { k, v } で左に値・右に説明、または文字列で1行）
      const section = (head, rows) => {
        const c = [text(head, { weight: 'bold', size: 'sm', color: BLUE })];
        rows.forEach((r) => {
          if (typeof r === 'string') {
            c.push(text(r, { size: 'sm', color: GRAY, wrap: true, margin: 'sm' }));
            return;
          }
          c.push({
            type: 'box', layout: 'baseline', margin: 'sm', spacing: 'sm',
            contents: [
              text(r.k, { size: 'sm', color: DARK, weight: 'bold', flex: 4, wrap: true }),
              text(r.v, { size: 'sm', color: GRAY, flex: 6, wrap: true, gravity: 'top' }),
            ],
          });
        });
        return { type: 'box', layout: 'vertical', spacing: 'none', margin: 'lg', contents: c };
      };
      const typeLine = typeList.map((t) => `${t.cd}：${t.label}`).join('　');
      const body = [
        text('勤怠Bot 使い方', { weight: 'bold', size: 'lg', color: DARK }),
        text('下のタブのボタン操作が基本。メッセージ入力でも操作できます。', { size: 'xs', color: GRAY, wrap: true, margin: 'sm' }),
        sep(),
        section('メニュー（下のタブ）', [
          { k: '勤怠登録', v: '出社・退社・欠勤／カレンダー登録' },
          { k: '稼働・提出', v: '稼働一覧・推移／未登録の登録・勤務表提出' },
          { k: '状況確認', v: '今週の状況・着地見込み・提出状況／勤務表を開く・翌月作成・休暇予約' },
        ]),
        section('休暇の予約', [
          '勤務表が未作成の月の休みは予約として保存され、その月の勤務表を作成したときに自動で反映されます。',
          { k: '休暇予約', v: '予約の確認・取消・追加' },
        ]),
        section('打刻（メッセージ入力）', [
          { k: '1900', v: '退社' },
          { k: '0900 1930', v: '出社・退社' },
          { k: '28 2104', v: '28日に退社' },
          { k: '1日 1900', v: '日付を指定（1th 1900 も可）' },
        ]),
        section('勤怠区分（先頭に付ける／出社は不要）', [
          typeLine,
          { k: 'h', v: '有給休暇として当日登録' },
          { k: 'w 1930', v: '休日出勤（退社1930）' },
        ]),
        section('稼働一覧', [
          { k: 'リスト', v: '当月' },
          { k: 'リスト 1', v: '先月（数字でNヶ月前）' },
        ]),
      ];
      return {
        type: 'bubble',
        size: 'mega',
        body: { type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: 'lg', contents: body },
      };
    },
  };
})();
