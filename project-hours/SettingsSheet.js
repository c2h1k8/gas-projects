/**
 * 設定シート（入力の設定と、報告シートへの反映の設定）。
 *
 * 入力単位・案件の選び方・刻み・案件枠の数は月シートの作成時に読み、そのシートの入力規則と数式に焼き込みます。
 * 所定労働時間は見込みの数式から直接参照するので、変えるとすべての月にすぐ反映されます。
 * 報告シートへの反映の設定は、反映のたびに読みます。
 */
const SettingsSheet = (function () {
  const S = Layout.SETTINGS;
  const ITEMS = [
    S.UNIT, S.PICK, S.STEP_MIN, S.STD_HOURS, S.SLOTS,
    S.REPORT_SHEET, S.REPORT_START_ROW, S.REPORT_DATE_COL, S.REPORT_CODE_COL, S.REPORT_NAME_COL,
    S.REPORT_HOURS_COL, S.REPORT_UNIT, S.REPORT_HOUR, S.REPORT_PREV_DAYS,
  ];
  const COLS = 3;
  const LAST_ROW = Math.max(...ITEMS.map((i) => i.row));
  const COL_RULE = '半角英字の列名（A, B, …）で入力してください。';
  /** 前月分も反映する日数の上限（月の日数を超えないように） */
  const PREV_DAYS_MAX = 28;

  /** 1回の実行で、既存の設定シートの項目の追加を確かめるのは1度だけにする */
  let upgraded_ = false;

  /** 設定シートを取得します（無ければ末尾に作る。古い設定シートには後から足した項目を差し込む）。 */
  const ensure = (ss) => {
    const sheet = ss.getSheetByName(Layout.SETTINGS_SHEET);
    if (!sheet) return create_(ss);
    if (!upgraded_) {
      upgrade_(sheet);
      upgraded_ = true;
    }
    return sheet;
  };

  const create_ = (ss) => {
    const sheet = ss.insertSheet(Layout.SETTINGS_SHEET, ss.getSheets().length);
    Style.fitSize(sheet, LAST_ROW, COLS);
    Style.base(sheet, Style.COLOR.TAB_SETTING);
    Style.title(sheet, '設定');
    sheet.getRange(1, S.VALUE_COL, LAST_ROW, 1).setHorizontalAlignment('center').setFontWeight('bold');
    S.SECTIONS.forEach((sec) => {
      sheet.getRange(sec.row, 1, 1, COLS).setValues([[sec.title, '値', '説明']])
        .setBackground(Style.COLOR.SECTION_BG).setFontColor(Style.COLOR.TOTAL_FG).setFontWeight('bold').setFontSize(10);
      sheet.setRowHeight(sec.row, 28);
    });
    ITEMS.forEach((item) => writeItem_(sheet, item));
    sheet.setColumnWidth(1, 150);
    sheet.setColumnWidth(2, 140);
    sheet.setColumnWidth(3, 560);
    return sheet;
  };

  /**
   * 後から足した項目の行を、古い設定シートへ差し込みます（入力済みの値はそのまま）。
   * 案件枠の数は「入力」の末尾に足したので、その行が別の項目なら行を挿入して下を1行ずらす
   * （所定労働時間の行は動かないので、月シートの見込みの数式はそのまま使える）。
   * それ以外の新しい項目は末尾の空いた行に書く。
   */
  const upgrade_ = (sheet) => {
    const label = (row) => String(sheet.getRange(row, 1).getValue());
    if (label(S.SLOTS.row) !== S.SLOTS.label) sheet.insertRowBefore(S.SLOTS.row);
    if (sheet.getMaxRows() < LAST_ROW) sheet.insertRowsAfter(sheet.getMaxRows(), LAST_ROW - sheet.getMaxRows());
    ITEMS.filter((item) => label(item.row) === '').forEach((item) => writeItem_(sheet, item));
  };

  /** 1項目の行（項目名・既定値・説明）を書き、入力規則と書式を付けます。 */
  const writeItem_ = (sheet, item) => {
    const row = sheet.getRange(item.row, 1, 1, COLS);
    row.setValues([[item.label, item.value, item.note]])
      .setFontFamily(Style.FONT).setFontSize(10).setFontColor(Style.COLOR.INK).setFontWeight('normal')
      .setBackground(null).setVerticalAlignment('middle');
    sheet.setRowHeight(item.row, 34);
    const value = sheet.getRange(item.row, S.VALUE_COL).setHorizontalAlignment('center').setFontWeight('bold');
    const rule = validation_(item);
    if (rule) value.setDataValidation(rule);
    if (item === S.STD_HOURS) value.setNumberFormat(Layout.HM_FORMAT);
    sheet.getRange(item.row, 3).setWrap(true).setFontColor(Style.COLOR.MUTED).setFontSize(9);
    Style.rowLines(row);
  };

  /** 項目の値の入力規則（無ければ null） */
  const validation_ = (item) => {
    const rule = () => SpreadsheetApp.newDataValidation().setAllowInvalid(false);
    const c = `B${item.row}`;
    const between = (min, max, help) => rule().requireFormulaSatisfied(`=AND(ISNUMBER(${c}), ${c}=INT(${c}), ${c}>=${min}, ${c}<=${max})`)
      .setHelpText(help).build();
    if (item.list) return rule().requireValueInList(item.list, true).build();
    if (item === S.STEP_MIN) return rule().requireNumberBetween(1, 60).setHelpText('1〜60 の分で入力してください。').build();
    if (item === S.STD_HOURS) {
      return rule().requireFormulaSatisfied(`=AND(ISNUMBER(${c}), ${c}>0, ${c}<1)`).setHelpText('8:00 のように時:分で入力してください。').build();
    }
    if (item === S.SLOTS) return between(1, Layout.SLOTS_MAX, `1〜${Layout.SLOTS_MAX} の整数で入力してください。`);
    if (item === S.REPORT_START_ROW) return rule().requireNumberBetween(1, 100000).setHelpText('1 以上の行番号を入力してください。').build();
    if (item === S.REPORT_HOUR) return rule().requireNumberBetween(0, 23).setHelpText('0〜23 の時を入力してください。').build();
    if (item === S.REPORT_PREV_DAYS) return between(0, PREV_DAYS_MAX, `0〜${PREV_DAYS_MAX} の日数を入力してください。`);
    // 列名。案件コード・案件名は空欄（書かない）も許す
    if ([S.REPORT_DATE_COL, S.REPORT_HOURS_COL, S.REPORT_CODE_COL, S.REPORT_NAME_COL].includes(item)) {
      const optional = item === S.REPORT_CODE_COL || item === S.REPORT_NAME_COL;
      const ok = `REGEXMATCH(${c}&"", "^[A-Za-z]{1,3}$")`;
      return rule().requireFormulaSatisfied(optional ? `=OR(${c}="", ${ok})` : `=${ok}`).setHelpText(COL_RULE).build();
    }
    return null;
  };

  const get_ = (ss, item) => ensure(ss).getRange(item.row, S.VALUE_COL).getValue();

  /**
   * 月シートの作成に使う設定を読みます。不正な値なら既定値に倒します。
   * @return {{ unit, pick, stepMin, slots }}
   */
  const read = (ss) => {
    const unit = get_(ss, S.UNIT) === Layout.UNIT.MINUTES ? Layout.UNIT.MINUTES : Layout.UNIT.HOURS;
    const pick = Object.values(Layout.PICK).includes(get_(ss, S.PICK)) ? get_(ss, S.PICK) : S.PICK.value;
    const step = Number(get_(ss, S.STEP_MIN));
    const stepMin = step >= 1 && step <= 60 ? step : S.STEP_MIN.value;
    const slots = intIn_(get_(ss, S.SLOTS), 1, Layout.SLOTS_MAX, S.SLOTS.value);
    return { unit, pick, stepMin, slots };
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

  /** min〜max の整数ならその値、そうでなければ既定値 */
  const intIn_ = (v, min, max, fallback) => {
    const n = Number(v);
    return v !== '' && Number.isInteger(n) && n >= min && n <= max ? n : fallback;
  };

  /** 反映時刻（時）。トリガーの設定に使う */
  const reportHour = (ss) => intIn_(get_(ss, S.REPORT_HOUR), 0, 23, S.REPORT_HOUR.value);

  /** 月初のこの日数までは前月分も反映する（0 なら前月分は書かない） */
  const reportPrevDays = (ss) => intIn_(get_(ss, S.REPORT_PREV_DAYS), 0, PREV_DAYS_MAX, S.REPORT_PREV_DAYS.value);

  /** 所定労働時間（時:分＝日の割合）のセル。数式から参照する */
  const stdHoursRef = () => `${Layout.sheetRef(Layout.SETTINGS_SHEET)}$${Layout.colA1(S.VALUE_COL)}$${S.STD_HOURS.row}`;

  return { ensure, read, readReport, reportHour, reportPrevDays, stdHoursRef };
})();
