/**
 * 設定シート（入力の設定と、報告シートへの反映の設定）。
 *
 * 入力単位・案件の選び方・刻みは月シートの作成時に読み、そのシートの入力規則と数式に焼き込みます。
 * 所定労働時間は見込みの数式から直接参照するので、変えるとすべての月にすぐ反映されます。
 * 報告シートへの反映の設定は、反映のたびに読みます。
 */
const SettingsSheet = (function () {
  const S = Layout.SETTINGS;
  const ITEMS = [
    S.UNIT, S.PICK, S.STEP_MIN, S.STD_HOURS,
    S.REPORT_SHEET, S.REPORT_START_ROW, S.REPORT_DATE_COL, S.REPORT_CODE_COL, S.REPORT_NAME_COL,
    S.REPORT_HOURS_COL, S.REPORT_UNIT, S.REPORT_HOUR,
  ];
  const COLS = 3;
  const COL_RULE = '半角英字の列名（A, B, …）で入力してください。';

  /** 設定シートを取得します（無ければ末尾に作る）。 */
  const ensure = (ss) => ss.getSheetByName(Layout.SETTINGS_SHEET) || create_(ss);

  const create_ = (ss) => {
    const sheet = ss.insertSheet(Layout.SETTINGS_SHEET, ss.getSheets().length);
    const lastRow = Math.max(...ITEMS.map((i) => i.row));
    Style.fitSize(sheet, lastRow, COLS);
    Style.base(sheet, Style.COLOR.TAB_SETTING);
    Style.title(sheet, '設定');

    S.SECTIONS.forEach((sec) => {
      sheet.getRange(sec.row, 1, 1, COLS).setValues([[sec.title, '値', '説明']])
        .setBackground(Style.COLOR.SECTION_BG).setFontColor(Style.COLOR.TOTAL_FG).setFontWeight('bold');
      sheet.setRowHeight(sec.row, 28);
    });
    ITEMS.forEach((item) => {
      sheet.getRange(item.row, 1, 1, COLS).setValues([[item.label, item.value, item.note]]);
      sheet.setRowHeight(item.row, 34);
    });

    const value = (item) => sheet.getRange(item.row, S.VALUE_COL);
    const rule = () => SpreadsheetApp.newDataValidation().setAllowInvalid(false);
    [S.UNIT, S.PICK, S.REPORT_UNIT].forEach((item) => {
      value(item).setDataValidation(rule().requireValueInList(item.list, true).build());
    });
    value(S.STEP_MIN).setDataValidation(rule().requireNumberBetween(1, 60).setHelpText('1〜60 の分で入力してください。').build());
    const std = `B${S.STD_HOURS.row}`;
    value(S.STD_HOURS).setNumberFormat(Layout.HM_FORMAT).setDataValidation(rule()
      .requireFormulaSatisfied(`=AND(ISNUMBER(${std}), ${std}>0, ${std}<1)`).setHelpText('8:00 のように時:分で入力してください。').build());
    value(S.REPORT_START_ROW).setDataValidation(rule().requireNumberBetween(1, 100000).setHelpText('1 以上の行番号を入力してください。').build());
    value(S.REPORT_HOUR).setDataValidation(rule().requireNumberBetween(0, 23).setHelpText('0〜23 の時を入力してください。').build());
    // 列名。案件コード・案件名は空欄（書かない）も許す
    [S.REPORT_DATE_COL, S.REPORT_HOURS_COL, S.REPORT_CODE_COL, S.REPORT_NAME_COL].forEach((item) => {
      const c = `B${item.row}`;
      const optional = item === S.REPORT_CODE_COL || item === S.REPORT_NAME_COL;
      const ok = `REGEXMATCH(${c}&"", "^[A-Za-z]{1,3}$")`;
      value(item).setDataValidation(rule().requireFormulaSatisfied(optional ? `=OR(${c}="", ${ok})` : `=${ok}`)
        .setHelpText(COL_RULE).build());
    });

    sheet.getRange(1, S.VALUE_COL, lastRow, 1).setHorizontalAlignment('center').setFontWeight('bold');
    sheet.getRange(1, 3, lastRow, 1).setWrap(true).setFontColor(Style.COLOR.MUTED).setFontSize(9);
    S.SECTIONS.forEach((sec) => sheet.getRange(sec.row, 1, 1, COLS).setFontColor(Style.COLOR.TOTAL_FG).setFontSize(10));
    ITEMS.forEach((item) => Style.rowLines(sheet.getRange(item.row, 1, 1, COLS)));
    sheet.setColumnWidth(1, 150);
    sheet.setColumnWidth(2, 140);
    sheet.setColumnWidth(3, 560);
    return sheet;
  };

  const get_ = (ss, item) => ensure(ss).getRange(item.row, S.VALUE_COL).getValue();

  /**
   * 月シートの作成に使う設定を読みます。不正な値なら既定値に倒します。
   * @return {{ unit, pick, stepMin }}
   */
  const read = (ss) => {
    const unit = get_(ss, S.UNIT) === Layout.UNIT.MINUTES ? Layout.UNIT.MINUTES : Layout.UNIT.HOURS;
    const pick = Object.values(Layout.PICK).includes(get_(ss, S.PICK)) ? get_(ss, S.PICK) : S.PICK.value;
    const step = Number(get_(ss, S.STEP_MIN));
    const stepMin = step >= 1 && step <= 60 ? step : S.STEP_MIN.value;
    return { unit, pick, stepMin };
  };

  /**
   * 報告シートへの反映の設定を読みます。必須の項目が欠けていればエラーにします
   * （他人のファイルに書き込むので、推測で埋めずに止める）。
   * @return {{ sheetName, startRow, dateCol, codeCol, nameCol, hoursCol, unit, hour }}（列は番号。書かない列は null）
   */
  const readReport = (ss) => {
    const sheetName = String(get_(ss, S.REPORT_SHEET)).trim();
    const startRow = Number(get_(ss, S.REPORT_START_ROW));
    const dateCol = Layout.colNo(get_(ss, S.REPORT_DATE_COL));
    const hoursCol = Layout.colNo(get_(ss, S.REPORT_HOURS_COL));
    const errors = [];
    if (!sheetName) errors.push('シート名');
    if (!(startRow >= 1)) errors.push('入力開始行');
    if (!dateCol) errors.push('日付の列');
    if (!hoursCol) errors.push('工数の列');
    if (errors.length) throw new Error(`設定シートの「報告シートへの反映」に未入力・不正な項目があります: ${errors.join('、')}`);
    const unit = Object.values(Layout.REPORT_UNIT).includes(get_(ss, S.REPORT_UNIT)) ? get_(ss, S.REPORT_UNIT) : S.REPORT_UNIT.value;
    const hour = Number(get_(ss, S.REPORT_HOUR));
    return {
      sheetName, startRow, dateCol, hoursCol, unit,
      codeCol: Layout.colNo(get_(ss, S.REPORT_CODE_COL)),
      nameCol: Layout.colNo(get_(ss, S.REPORT_NAME_COL)),
      hour: hour >= 0 && hour <= 23 ? hour : S.REPORT_HOUR.value,
    };
  };

  /** 反映時刻（時）。トリガーの設定に使う */
  const reportHour = (ss) => {
    const hour = Number(get_(ss, S.REPORT_HOUR));
    return Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : S.REPORT_HOUR.value;
  };

  /** 所定労働時間（時:分＝日の割合）のセル。数式から参照する */
  const stdHoursRef = () => `${Layout.sheetRef(Layout.SETTINGS_SHEET)}$${Layout.colA1(S.VALUE_COL)}$${S.STD_HOURS.row}`;

  return { ensure, read, readReport, reportHour, stdHoursRef };
})();
