/**
 * 案件マスタ。案件コード・案件名・略称・報告対象を管理し、日の入力の選択肢を作ります。
 *
 * 日の入力のプルダウンには、設定シートの「案件の選び方」に応じて
 * 「コード：案件名」（選択肢列）・案件コード・案件名・略称のどれかの列を使います。
 * 「コード：案件名」「案件コード」の月はコードで集計するので、後から案件名を変えても過去の工数は数えられます
 * （「コード：案件名」で入力したセルは古い案件名のまま残り、入力規則の警告が付きます）。
 * 「案件名」「略称」の月はその値で集計するので、変えるとその月の工数は数えられなくなります。
 * 集計欄・サマリの見出しは、略称があれば略称、無ければ案件名で出します。
 * 並び（サマリの列・案件別集計・日の入力のプルダウン）は表示順の小さい順で、
 * 表示順が空欄の案件はその後ろにマスタの順で並べます。
 * プルダウンは、選び方ごとの値を表示順に並べ直した非表示の一覧列（PICK_LISTS）を参照します。
 */
const MasterSheet = (function () {
  const M = Layout.MASTER;

  /** 案件マスタを取得します（無ければ作る）。 */
  const ensure = (ss) => ss.getSheetByName(Layout.MASTER_SHEET) || create_(ss);

  /** 表示順の列の幅・入力規則・説明 */
  const setupOrderColumn_ = (sheet) => {
    const first = M.FIRST_ROW;
    const c = `${Layout.colA1(M.ORDER)}${first}`;
    sheet.setColumnWidth(M.ORDER, 70);
    sheet.getRange(first, M.ORDER, sheet.getMaxRows() - first + 1, 1)
      .setHorizontalAlignment('center').setNumberFormat('0.##')
      .setDataValidation(SpreadsheetApp.newDataValidation().setAllowInvalid(false)
        .requireFormulaSatisfied(`=ISNUMBER(${c})`).setHelpText('数字を入力してください（空欄なら後ろに並ぶ）。').build());
    sheet.getRange(M.HEADER_ROW, M.ORDER)
      .setNote('サマリの列と月シートの案件別集計を、この数字の小さい順に並べます。空欄の案件は後ろにマスタの順で並びます。変えたら「サマリを更新」で反映。');
  };

  const create_ = (ss) => {
    const sheet = ss.insertSheet(Layout.MASTER_SHEET, ss.getSheets().length);
    const width = M.HEADERS.length;
    const first = M.FIRST_ROW;
    const rows = M.ROWS;
    Style.fitSize(sheet, first + rows - 1, width);
    Style.base(sheet, Style.COLOR.TAB_SETTING);
    Style.title(sheet, '案件マスタ');
    Style.sheetLink(sheet.getRange(1, M.NOTE), ss.getSheetByName(Layout.SUMMARY_SHEET), '← サマリ');
    sheet.getRange(2, 1).setValue('使い終わった案件も、過去の月の集計に使うので行は消さないでください。')
      .setFontColor(Style.COLOR.MUTED).setFontSize(9);

    Style.header(sheet.getRange(M.HEADER_ROW, 1, 1, width).setValues([M.HEADERS]));
    sheet.setFrozenRows(M.HEADER_ROW);
    sheet.setColumnWidth(M.CODE, 110);
    sheet.setColumnWidth(M.NAME, 240);
    sheet.setColumnWidth(M.SHORT, 120);
    sheet.setColumnWidth(M.REPORT, 80);
    setupOrderColumn_(sheet);
    sheet.setColumnWidth(M.LABEL, 260);
    sheet.setColumnWidth(M.NOTE, 240);
    sheet.setRowHeights(first, rows, 26);
    Style.rowLines(sheet.getRange(first, 1, rows, width));

    const col = (c) => sheet.getRange(first, c, rows, 1);
    const a1 = (c) => Layout.colA1(c);
    const rule = () => SpreadsheetApp.newDataValidation().setAllowInvalid(false);

    // 選択肢列は1つの配列数式で全行ぶん作る（行を足しても数式のコピーが要らない）
    const code = a1(M.CODE);
    const name = a1(M.NAME);
    sheet.getRange(first, M.LABEL).setFormula(
      `=ARRAYFORMULA(IF(${code}${first}:${code}="", "", ${code}${first}:${code}&"${Layout.LABEL_SEPARATOR}"&${name}${first}:${name}))`
    );
    col(M.LABEL).setBackground(Style.COLOR.AUTO_BG).setFontColor(Style.COLOR.MUTED);

    // 案件コードは集計のキーなので、記号を含めず重複も許さない
    col(M.CODE).setNumberFormat('@').setFontWeight('bold').setDataValidation(rule()
      .requireFormulaSatisfied(`=AND(REGEXMATCH(${code}${first}&"", "^[A-Za-z0-9_-]+$"), COUNTIF($${code}$${first}:$${code}, ${code}${first})=1)`)
      .setHelpText('半角英数字・ハイフン・アンダースコアで、他の案件と重ならないコードを入力してください。').build());
    // 案件名・略称も選び方によっては集計キーになるので重複させない（略称は空欄でも可）
    col(M.NAME).setDataValidation(rule()
      .requireFormulaSatisfied(`=COUNTIF($${name}$${first}:$${name}, ${name}${first})=1`)
      .setHelpText('他の案件と重ならない案件名を入力してください。').build());
    const short = a1(M.SHORT);
    col(M.SHORT).setDataValidation(rule()
      .requireFormulaSatisfied(`=OR(${short}${first}="", COUNTIF($${short}$${first}:$${short}, ${short}${first})=1)`)
      .setHelpText('他の案件と重ならない略称を入力してください（空欄でも可）。').build());
    // 空欄はチェックなしとして表示されるので、値を入れずに入力規則だけ付ける（最終行が伸びないように）
    col(M.REPORT).setDataValidation(SpreadsheetApp.newDataValidation().requireCheckbox().build())
      .setHorizontalAlignment('center');

    sheet.getRange(M.HEADER_ROW, M.REPORT).setNote('チェックした案件だけを報告シートへ書き込みます。');
    sheet.getRange(M.HEADER_ROW, M.LABEL).setNote('「コード：案件名」で選ぶときのプルダウンの値です。自動で作られます。');
    // プルダウン用の一覧。選び方ごとの列（選択肢・コード・案件名・略称）の値を、空欄を除いて表示順に並べる
    const order = a1(M.ORDER);
    Object.entries(M.PICK_LISTS).forEach(([pick, listCol]) => {
      const src = a1(PICK_COL[pick]);
      const r = (c) => `${c}${first}:${c}`;
      sheet.getRange(first, listCol).setFormula(`=IFERROR(LET(v, ${r(src)}, o, ${r(order)}, ok, (${r(code)}<>"")*(v<>""), `
        + `SORTBY(FILTER(v, ok), FILTER(IF(ISNUMBER(o), o, 1E+15), ok), 1, FILTER(ROW(v), ok), 1)), "")`);
    });
    const lists = Object.values(M.PICK_LISTS);
    sheet.getRange(M.HEADER_ROW, Math.min(...lists), rows + 1, lists.length).protect()
      .setDescription('プルダウン用の一覧は自動生成のため編集不可').setWarningOnly(true);
    sheet.hideColumns(Math.min(...lists), lists.length);

    sheet.getRange(M.HEADER_ROW, M.LABEL, rows + 1, 1).protect()
      .setDescription('選択肢は自動生成のため編集不可').setWarningOnly(true);
    return sheet;
  };

  /** 案件の選び方ごとに、プルダウンの元にする列 */
  const PICK_COL = {
    [Layout.PICK.LABEL]: M.LABEL, [Layout.PICK.CODE]: M.CODE, [Layout.PICK.NAME]: M.NAME, [Layout.PICK.SHORT]: M.SHORT,
  };

  /** 日の入力の入力規則が参照する範囲（表示順に並べた一覧の列。列の最終行まで取るので、マスタに行を足しても選べる） */
  const pickRange = (ss, pick) => {
    const sheet = ensure(ss);
    return sheet.getRange(M.FIRST_ROW, M.PICK_LISTS[pick], sheet.getMaxRows() - M.FIRST_ROW + 1, 1);
  };

  /**
   * 登録されている案件を表示順に返します（表示順の小さい順。空欄は後ろにマスタの順）。
   * @return [{ code, name, short, report, display }]（display＝見出しに出す名前。略称があれば略称）
   */
  const getProjects = (ss) => {
    const sheet = ensure(ss);
    const last = sheet.getLastRow();
    if (last < M.FIRST_ROW) return [];
    return sheet.getRange(M.FIRST_ROW, 1, last - M.FIRST_ROW + 1, M.HEADERS.length).getValues()
      .filter((r) => String(r[M.CODE - 1]).trim() !== '')
      .map((r) => {
        const name = String(r[M.NAME - 1]);
        const short = String(r[M.SHORT - 1]).trim();
        const order = r[M.ORDER - 1];
        return {
          code: String(r[M.CODE - 1]).trim(), name, short, display: short || name, report: r[M.REPORT - 1] === true,
          order: typeof order === 'number' ? order : Infinity,
        };
      })
      .sort((a, b) => (a.order === b.order ? 0 : a.order - b.order)); // 同じ表示順・空欄どうしはマスタの順のまま
  };

  /** 数式で使う「コード列・案件名列・略称列・表示順列」の範囲（例: '案件マスタ'!A4:A） */
  const formulaRanges = () => {
    const ref = Layout.sheetRef(Layout.MASTER_SHEET);
    const col = (c) => `${ref}${Layout.colA1(c)}${M.FIRST_ROW}:${Layout.colA1(c)}`;
    return { codes: col(M.CODE), names: col(M.NAME), shorts: col(M.SHORT), orders: col(M.ORDER) };
  };

  return { ensure, pickRange, getProjects, formulaRanges };
})();
