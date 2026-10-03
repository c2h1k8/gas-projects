/**
 * サマリシート（1行1ヶ月を新しい順に、稼働日数・月合計・見込み・報告シート・案件別の工数を並べる）。
 *
 * 月は年ごとにまとめ、年の見出し行に小計を出して、その年の月の行を折りたためるようにしています
 * （今年は開き、過去の年は閉じておく）。一番下は全期間の合計です。
 *
 * 値はすべて月シートを参照する数式なので、日々の入力はそのまま反映されます。
 * 作り直しが要るのは「行（月シート）」と「列（案件）」が増減したときだけで、
 * 月シートの作成時・案件マスタの編集時・メニューの「サマリを更新」で作り直します。
 *
 * 「報告シート」列だけは手入力（月ごとの報告ファイルのリンク）なので、作り直しても月ごとに残します。
 * 「最終反映」列は報告シートへの反映結果で、これも残します。
 */
const SummarySheet = (function () {
  const S = Layout.SUMMARY;

  /** サマリシートを取得します（無ければ先頭に作る）。 */
  const ensure = (ss) => {
    const existing = ss.getSheetByName(Layout.SUMMARY_SHEET);
    if (existing) return existing;
    const sheet = ss.insertSheet(Layout.SUMMARY_SHEET, 0);
    sheet.protect().setDescription('サマリは自動生成のため編集不可（報告シート列を除く）').setWarningOnly(true);
    return sheet;
  };

  /** 月シート名 → 行番号（年月の列の表示値で引く） */
  const rowsByMonth_ = (sheet) => {
    const map = new Map();
    const last = sheet.getLastRow();
    if (last < S.FIRST_ROW) return map;
    sheet.getRange(S.FIRST_ROW, S.YM, last - S.FIRST_ROW + 1, 1).getDisplayValues()
      .forEach(([name], i) => { if (Layout.MONTH_SHEET_PATTERN.test(name)) map.set(name, S.FIRST_ROW + i); });
    return map;
  };

  /**
   * 「報告シート」列のリンク先 URL を行ごとに読みます。
   * スマートチップのリンク先はスプレッドシートのサービスからは読めないので、Sheets API で読む
   * （API が使えないときはリンクと文字列から読む）。
   * @return Map<行番号, URL>
   */
  const linkUrls_ = (ss, sheet, rows) => {
    const urls = new Map();
    if (!rows.length) return urls;
    const from = Math.min(...rows);
    const to = Math.max(...rows);
    const col = Layout.colA1(S.REPORT_LINK);
    try {
      const res = Sheets.Spreadsheets.get(ss.getId(), {
        ranges: [`${Layout.sheetRef(sheet.getName())}${col}${from}:${col}${to}`],
        fields: 'sheets.data.rowData.values(chipRuns.chip.richLinkProperties.uri,hyperlink,textFormatRuns.format.link.uri,formattedValue)',
      });
      const rowData = (res.sheets[0].data[0].rowData) || [];
      rowData.forEach((r, i) => {
        const v = (r.values || [])[0] || {};
        const chip = (v.chipRuns || []).map((c) => c.chip && c.chip.richLinkProperties && c.chip.richLinkProperties.uri).find((u) => u);
        const run = (v.textFormatRuns || []).map((t) => t.format && t.format.link && t.format.link.uri).find((u) => u);
        const url = chip || v.hyperlink || run || (v.formattedValue || '').trim();
        if (url) urls.set(from + i, url);
      });
      return urls;
    } catch (e) {
      console.warn(`Sheets API でリンクを読めませんでした: ${e.message}`);
    }
    rows.forEach((row) => {
      const cell = sheet.getRange(row, S.REPORT_LINK);
      const rich = cell.getRichTextValue();
      const url = (rich && (rich.getLinkUrl() || rich.getRuns().map((r) => r.getLinkUrl()).find((u) => u)))
        || String(cell.getValue()).trim();
      if (url) urls.set(row, url);
    });
    return urls;
  };

  /**
   * 作り直しても残す手入力の列（報告シート）と反映結果の列を、月ごとに控えます。
   * 報告シートは表示名とリンク先 URL を控え、作り直した後はリンクとして貼り直す
   * （スマートチップは作り直せないため、通常のリンクになる）。
   */
  const keepManual_ = (ss, sheet) => {
    const kept = new Map();
    const byMonth = rowsByMonth_(sheet);
    const urls = linkUrls_(ss, sheet, [...byMonth.values()]);
    byMonth.forEach((row, name) => {
      kept.set(name, {
        text: sheet.getRange(row, S.REPORT_LINK).getDisplayValue(),
        url: urls.get(row) || '',
        reportedAt: sheet.getRange(row, S.REPORTED_AT).getValue(),
      });
    });
    return kept;
  };

  /** サマリを作り直します。 */
  const rebuild = (ss) => {
    const sheet = ensure(ss);
    const kept = keepManual_(ss, sheet);
    const projects = MasterSheet.getProjects(ss);
    const months = MonthSheet.list(ss);
    const width = S.FIRST_PROJECT + projects.length - 1;
    const first = S.FIRST_ROW;
    const a1 = Layout.colA1;
    const sumCols = [S.WORK_DAYS, S.TOTAL, S.FORECAST, ...projects.map((_, i) => S.FIRST_PROJECT + i)];

    // 年ごとにまとめる（月は新しい順なので、年も新しい順になる）
    const years = [];
    months.forEach((m) => {
      const year = m.getName().slice(0, 4);
      if (!years.length || years[years.length - 1].year !== year) years.push({ year, months: [] });
      years[years.length - 1].months.push(m);
    });
    let row = first;
    years.forEach((y) => {
      y.row = row;
      y.from = row + 1;
      y.to = row + y.months.length;
      row = y.to + 1;
    });
    const totalRow = row;

    removeRowGroups_(sheet);
    sheet.clear();
    sheet.clearConditionalFormatRules();
    Style.fitSize(sheet, Math.max(totalRow, first), width);
    Style.base(sheet, Style.COLOR.TAB_SUMMARY);
    Style.title(sheet, '工数サマリ'); // 年月の列を固定しているので結合せず、列幅で収める
    sheet.getRange(2, 1).setValue('「報告シート」列に月ごとの報告ファイルのリンクを貼ると、毎晩その月の工数を書き込みます。')
      .setFontColor(Style.COLOR.MUTED).setFontSize(9);

    const headers = ['年月', '稼働日数', '合計工数', '見込み', '報告シート', '最終反映', ...projects.map((p) => `${p.code}\n${p.display}`)];
    Style.header(sheet.getRange(S.HEADER_ROW, 1, 1, width).setValues([headers]));
    sheet.setRowHeight(S.HEADER_ROW, 40);

    if (!months.length) {
      sheet.getRange(first, 1).setValue('月シートがまだありません。メニューの「当月シートを作成」から作れます。')
        .setFontColor(Style.COLOR.MUTED);
      return;
    }

    // 年の見出し行（小計）と月の行
    const rows = [];
    const monthRows = new Map(); // 月シート名 → 行番号
    years.forEach((y) => {
      const subtotal = new Array(width).fill('');
      subtotal[S.YM - 1] = `${y.year}年`;
      sumCols.forEach((c) => { subtotal[c - 1] = `=SUM(${a1(c)}${y.from}:${a1(c)}${y.to})`; });
      rows.push(subtotal);
      y.months.forEach((m) => {
        const name = m.getName();
        monthRows.set(name, first + rows.length);
        rows.push([
          `=HYPERLINK("#gid=${m.getSheetId()}", "${name}")`,
          `=${MonthSheet.workDaysRef(name)}`,
          `=${MonthSheet.totalRef(name)}`,
          `=${MonthSheet.forecastRef(name)}`,
          '',
          '',
          ...projects.map((p) => MonthSheet.projectTotalFormula(m, p)),
        ]);
      });
    });
    // 年のラベル（文字）と数式が混ざるので setValues で書く（「=」で始まる値は数式として入る）
    sheet.getRange(first, 1, rows.length, width).setValues(rows);
    monthRows.forEach((r, name) => {
      const k = kept.get(name);
      if (!k) return;
      const cell = sheet.getRange(r, S.REPORT_LINK);
      if (k.url) {
        const text = k.text || k.url;
        cell.setRichTextValue(SpreadsheetApp.newRichTextValue().setText(text).setLinkUrl(k.url).build());
      } else if (k.text) {
        cell.setValue(k.text);
      }
      if (k.reportedAt !== '') sheet.getRange(r, S.REPORTED_AT).setValue(k.reportedAt);
    });

    // 合計行（年の小計を足す。報告シートの列は合計しない）
    const totals = new Array(width).fill('');
    totals[S.YM - 1] = '合計';
    sumCols.forEach((c) => { totals[c - 1] = `=SUM(${years.map((y) => `${a1(c)}${y.row}`).join(',')})`; });
    sheet.getRange(totalRow, 1, 1, width).setValues([totals]);

    const body = (c, n = 1) => sheet.getRange(first, c, rows.length + 1, n);
    sheet.setRowHeights(first, rows.length + 1, 28);
    Style.rowLines(sheet.getRange(first, 1, rows.length + 1, width));
    body(S.YM).setHorizontalAlignment('center');
    body(S.WORK_DAYS).setNumberFormat('0"日"').setHorizontalAlignment('center');
    body(S.TOTAL, 2).setNumberFormat(Layout.HM_FORMAT).setHorizontalAlignment('center');
    body(S.TOTAL).setFontWeight('bold').setFontColor(Style.COLOR.ACCENT);
    body(S.FORECAST).setFontColor(Style.COLOR.MUTED);
    body(S.REPORTED_AT).setFontColor(Style.COLOR.MUTED).setFontSize(9).setWrap(true).setHorizontalAlignment('center');
    if (projects.length) body(S.FIRST_PROJECT, projects.length).setNumberFormat(Layout.HM_FORMAT).setHorizontalAlignment('center');
    // 合計行は表の締めとして濃い色にする（列ごとの文字色より後に当てて上書きする）
    sheet.getRange(totalRow, 1, 1, width)
      .setBackground(Style.COLOR.GRAND_BG).setFontColor(Style.COLOR.GRAND_FG).setFontWeight('bold');

    // 年の見出し行は月の行（白）・合計行（濃い藍）と見分けられる帯にし、その年の月の行を折りたためるようにする（今年以外は閉じる）
    const thisYear = String(new Date().getFullYear());
    // 開閉ボタンをグループの前（年の見出し行）に出す
    sheet.setRowGroupControlPosition(SpreadsheetApp.GroupControlTogglePosition.BEFORE);
    years.forEach((y) => {
      sheet.getRange(y.row, 1, 1, width)
        .setBackground(Style.COLOR.YEAR_BG).setFontColor(Style.COLOR.YEAR_FG).setFontWeight('bold');
      sheet.getRange(y.from, 1, y.months.length, 1).shiftRowGroupDepth(1);
      if (y.year !== thisYear) sheet.getRowGroup(y.from, 1).collapse();
    });

    sheet.setFrozenRows(S.HEADER_ROW);
    sheet.setFrozenColumns(S.YM);
    sheet.setColumnWidth(S.YM, 120); // タイトル「工数サマリ」が収まる幅
    sheet.setColumnWidth(S.WORK_DAYS, 72);
    sheet.setColumnWidth(S.TOTAL, 84);
    sheet.setColumnWidth(S.FORECAST, 84);
    sheet.setColumnWidth(S.REPORT_LINK, 200);
    sheet.setColumnWidth(S.REPORTED_AT, 170);
    for (let c = S.FIRST_PROJECT; c <= width; c++) sheet.setColumnWidth(c, 110);

    // 報告シートの列だけは手入力なので、保護の対象から外す
    const protection = sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET)[0];
    if (protection) protection.setUnprotectedRanges([...monthRows.values()].map((r) => sheet.getRange(r, S.REPORT_LINK)));
  };

  /** 前回作った行のグループ（年ごとの折りたたみ）をすべて外します。 */
  const removeRowGroups_ = (sheet) => {
    for (let r = 1; r <= sheet.getMaxRows(); r++) {
      for (let d = sheet.getRowGroupDepth(r); d > 0; d--) {
        const group = sheet.getRowGroup(r, d);
        if (group) group.remove();
      }
    }
  };

  /**
   * 月の報告ファイルの ID を返します（リンク・URL・スマートチップのどれで貼っても読む）。
   * @return ファイル ID / 貼られていなければ null
   */
  const reportFileId = (ss, monthName) => {
    const sheet = ensure(ss);
    const row = rowsByMonth_(sheet).get(monthName);
    if (!row) return null;
    const url = linkUrls_(ss, sheet, [row]).get(row);
    if (!url) return null;
    const m = url.match(/\/d\/([a-zA-Z0-9_-]{20,})/) || url.match(/[?&]id=([a-zA-Z0-9_-]{20,})/) || url.match(/^([a-zA-Z0-9_-]{30,})$/);
    return m ? m[1] : null;
  };

  /** 報告シートへの反映結果を「最終反映」列に書きます。 */
  const setReportStatus = (ss, monthName, text) => {
    const sheet = ensure(ss);
    const row = rowsByMonth_(sheet).get(monthName);
    if (row) sheet.getRange(row, S.REPORTED_AT).setValue(text);
  };

  return { ensure, rebuild, reportFileId, setReportStatus };
})();
