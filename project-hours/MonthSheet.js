/**
 * 月シート（1日1行で、案件ごとの工数を入力する）。
 *
 * 1日に案件枠を Layout.SLOT_COUNT 個並べ、各枠で「案件（プルダウン）と工数」を入力します。
 * 日合計・月合計・見込み・案件別集計はすべてシート上の数式なので、入力するとその場で反映されます。
 *
 * 工数の入力単位（時間／分）と案件の選び方は作成時に設定シートから決め、そのシートでは固定です。
 * 作成時の値はシートの開発者メタデータに残し、サマリと報告シートへの反映が値の意味を知るのに使います。
 * 合計はどちらの単位でも時:分（日の割合）に揃えるので、サマリは単位の違う月を混ぜて扱えます。
 */
const MonthSheet = (function () {
  const C = Layout.MONTH;
  const isMonth_ = (sheet) => Layout.MONTH_SHEET_PATTERN.test(sheet.getName());
  const a1 = Layout.colA1;

  /** 月シート名（'2026-10'） */
  const nameOf = (date) => Utilities.formatDate(date, Session.getScriptTimeZone(), Layout.MONTH_SHEET_FORMAT);

  /** 月シート名からその月の1日を返します。 */
  const firstDateOf_ = (name) => {
    const [y, m] = name.split('-').map(Number);
    return new Date(y, m - 1, 1);
  };

  /** その月の日の行（最初と最後） */
  const dayRows_ = (name) => {
    const first = firstDateOf_(name);
    const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    return { first: C.FIRST_DAY_ROW, last: C.FIRST_DAY_ROW + days - 1, days };
  };

  /** 月シートを新しい順に返します。 */
  const list = (ss) => ss.getSheets()
    .filter(isMonth_)
    .sort((a, b) => (a.getName() < b.getName() ? 1 : -1));

  /**
   * 指定日の月のシートを作ります。既にあれば何もしません。
   * @return { sheet, created }
   */
  const ensure = (ss, date) => {
    const name = nameOf(date);
    const existing = ss.getSheetByName(name);
    if (existing) return { sheet: existing, created: false };
    const sheet = ss.insertSheet(name, insertIndex_(ss, name));
    build_(ss, sheet);
    return { sheet, created: true };
  };

  /**
   * 新しい月シートの挿入位置（0始まり）。
   * 月シートはサマリの後ろに新しい順で並べ、案件マスタより前に置く。
   */
  const insertIndex_ = (ss, name) => {
    const sheets = ss.getSheets();
    const older = sheets.findIndex((s) => isMonth_(s) && s.getName() < name);
    if (older >= 0) return older;
    const lastMonth = sheets.reduce((idx, s, i) => (isMonth_(s) ? i : idx), -1);
    if (lastMonth >= 0) return lastMonth + 1;
    const summary = sheets.findIndex((s) => s.getName() === Layout.SUMMARY_SHEET);
    return summary + 1; // サマリが無ければ先頭（-1 + 1 = 0）
  };

  /** 作成時の入力単位と案件の選び方を返します（メタデータが無い古いシートは既定値）。 */
  const settingsOf = (sheet) => {
    const meta = new Map(sheet.getDeveloperMetadata().map((m) => [m.getKey(), m.getValue()]));
    return {
      unit: meta.get(Layout.META.UNIT) || Layout.UNIT.HOURS,
      pick: meta.get(Layout.META.PICK) || Layout.PICK.LABEL,
    };
  };

  /** 入力値（時間または分）を時:分の値（日の割合）に直す式 */
  const toDuration_ = (unit, expr) => `(${expr})/${unit === Layout.UNIT.MINUTES ? 1440 : 24}`;

  /**
   * ある案件の工数を全枠から合計する式（入力単位のまま）。
   * 枠の値との突き合わせは案件の選び方で変える。案件名に * や ? が入っていても正しく引けるよう、
   * SUMIF のワイルドカードではなく文字列の一致で比べる。
   * @param prefix 他シートから参照するときのシート名（'2026-10'!）。同じシート内なら ''
   * @param keys { code, name, short } それぞれ数式（変数名や "P001" のような文字列リテラル）
   */
  const sumExpr_ = (prefix, pick, keys, first, last) => {
    const sep = Layout.LABEL_SEPARATOR;
    const match = {
      [Layout.PICK.LABEL]: (r) => `(LEFT(${r}, LEN(${keys.code})+${sep.length})=${keys.code}&"${sep}")`,
      [Layout.PICK.CODE]: (r) => `(${r}&""=${keys.code})`,
      // 案件名・略称が空の案件は、案件を選んでいない枠と一致してしまうので数えない
      [Layout.PICK.NAME]: (r) => `(${keys.name}<>"")*(${r}&""=${keys.name})`,
      [Layout.PICK.SHORT]: (r) => `(${keys.short}<>"")*(${r}&""=${keys.short})`,
    }[pick];
    return [...Array(Layout.SLOT_COUNT).keys()].map((i) => {
      const code = a1(Layout.slotCodeCol(i));
      const hours = a1(Layout.slotHoursCol(i));
      const r = `${prefix}$${code}$${first}:$${code}$${last}`;
      return `SUMPRODUCT(${match(r)}*${prefix}$${hours}$${first}:$${hours}$${last})`;
    }).join(' + ');
  };

  const build_ = (ss, sheet) => {
    const { unit, pick, stepMin } = SettingsSheet.read(ss);
    const isMin = unit === Layout.UNIT.MINUTES;
    const firstDate = firstDateOf_(sheet.getName());
    const { first, last, days } = dayRows_(sheet.getName());
    const width = C.NOTE;
    const col = (c) => `${a1(c)}${first}:${a1(c)}${last}`;
    const hoursCols = [...Array(Layout.SLOT_COUNT).keys()].map((i) => Layout.slotHoursCol(i));

    Style.fitSize(sheet, last, width);
    Style.base(sheet, Style.COLOR.TAB_MONTH);
    sheet.addDeveloperMetadata(Layout.META.UNIT, unit);
    sheet.addDeveloperMetadata(Layout.META.PICK, pick);

    // タイトル（右に作成時の設定を小さく添える）
    Style.title(sheet, Utilities.formatDate(firstDate, Session.getScriptTimeZone(), 'yyyy年M月'));
    sheet.getRange(C.TITLE_ROW, C.FIRST_SLOT).setValue(`入力単位：${unit}　／　案件の選び方：${pick}　／　${stepMin}分刻み`)
      .setFontColor(Style.COLOR.MUTED).setFontSize(9);

    // 見出し
    const headers = new Array(width).fill('');
    headers[C.DATE - 1] = '日付';
    headers[C.DOW - 1] = '曜日';
    headers[C.DAY_TOTAL - 1] = '日合計';
    for (let i = 0; i < Layout.SLOT_COUNT; i++) {
      headers[Layout.slotCodeCol(i) - 1] = `案件 ${i + 1}`;
      headers[Layout.slotHoursCol(i) - 1] = `工数（${unit}）`;
    }
    headers[C.NOTE - 1] = '備考';
    Style.header(sheet.getRange(C.HEADER_ROW, 1, 1, width).setValues([headers]));

    // 日付・曜日・日合計
    const rows = [];
    const totals = [];
    for (let d = 1; d <= days; d++) {
      const date = new Date(firstDate.getFullYear(), firstDate.getMonth(), d);
      const row = first + d - 1;
      const dow = DateUtils.getDayOfWeek(date);
      const isSat = date.getDay() === 6;
      const isSun = date.getDay() === 0;
      const isHoliday = !isSat && !isSun && !DateUtils.isBizDate(date);
      rows.push([date, isHoliday ? `${dow}${Layout.HOLIDAY_MARK}` : dow]);
      const cells = hoursCols.map((c) => `${a1(c)}${row}`).join(',');
      totals.push([`=IF(COUNT(${cells})=0, "", ${toDuration_(unit, `SUM(${cells})`)})`]);
      // 土曜は青、日曜・祝日は赤の行にする（日合計の列は合計の色のまま）
      if (isSat || isSun || isHoliday) {
        const fg = isSat ? Style.COLOR.SAT_FG : Style.COLOR.HOLIDAY_FG;
        const bg = isSat ? Style.COLOR.SAT_BG : Style.COLOR.HOLIDAY_BG;
        sheet.getRange(row, C.DATE, 1, 2).setFontColor(fg).setFontWeight('bold').setBackground(bg);
        sheet.getRange(row, C.FIRST_SLOT, 1, width - C.FIRST_SLOT + 1).setBackground(bg);
      }
    }
    sheet.getRange(first, C.DATE, days, 2).setValues(rows).setHorizontalAlignment('center');
    sheet.getRange(first, C.DATE, days, 1).setNumberFormat('M/d');
    sheet.getRange(first, C.DAY_TOTAL, days, 1).setFormulas(totals).setNumberFormat(Layout.HM_FORMAT)
      .setFontWeight('bold').setFontColor(Style.COLOR.TOTAL_FG).setBackground(Style.COLOR.TOTAL_BG).setHorizontalAlignment('center');
    sheet.setRowHeights(first, days, 26);
    Style.rowLines(sheet.getRange(first, 1, days, width));

    // 月合計・見込み・稼働日数
    // 見込み＝月合計＋今日以降でまだ入力の無い営業日（平日かつ祝日でない日）×所定労働時間
    const monthTotal = `${a1(C.DAY_TOTAL)}${C.TOTAL_ROW}`;
    const remaining = `SUMPRODUCT((WEEKDAY(${col(C.DATE)}, 2)<6)*ISERROR(SEARCH("${Layout.HOLIDAY_MARK}", ${col(C.DOW)}))`
      + `*(INT(${col(C.DATE)})>=TODAY())*(${col(C.DAY_TOTAL)}=""))`;
    sheet.getRange(C.TOTAL_ROW, C.LABEL_COL, 3, 1).setValues([['月合計'], ['見込み'], ['稼働日数']]);
    sheet.getRange(C.TOTAL_ROW, C.DAY_TOTAL, 3, 1).setFormulas([
      [`=SUM(${col(C.DAY_TOTAL)})`],
      [`=${monthTotal}+${remaining}*${SettingsSheet.stdHoursRef()}`],
      [`=COUNT(${col(C.DAY_TOTAL)})`],
    ]);
    [C.TOTAL_ROW, C.FORECAST_ROW, C.WORK_DAYS_ROW].forEach((r) => {
      sheet.getRange(r, C.LABEL_COL, 1, 2).merge();
      sheet.setRowHeight(r, 28);
    });
    sheet.getRange(C.TOTAL_ROW, C.LABEL_COL, 3, 1).setFontColor(Style.COLOR.MUTED).setFontSize(9).setHorizontalAlignment('right');
    sheet.getRange(C.TOTAL_ROW, C.DAY_TOTAL, 2, 1).setNumberFormat(Layout.HM_FORMAT);
    sheet.getRange(C.WORK_DAYS_ROW, C.DAY_TOTAL).setNumberFormat('0"日"');
    sheet.getRange(C.TOTAL_ROW, C.DAY_TOTAL, 3, 1).setHorizontalAlignment('center').setFontWeight('bold').setFontColor(Style.COLOR.INK);
    sheet.getRange(C.TOTAL_ROW, C.DAY_TOTAL).setFontSize(14).setFontColor(Style.COLOR.ACCENT);
    sheet.getRange(C.FORECAST_ROW, C.LABEL_COL)
      .setNote('月合計に、今日以降でまだ入力していない営業日を所定労働時間（設定シート）で埋めた分を足した値です。');

    // 案件別集計（月合計の右に、案件枠の列に合わせて横に並べる）
    const cap = Layout.SLOT_COUNT * C.AGG_ROWS;
    sheet.getRange(C.AGG_TITLE_ROW, C.AGG_FIRST_COL).setValue(`案件別集計（最大${cap}件。全件はサマリ）`)
      .setFontColor(Style.COLOR.MUTED).setFontSize(9);
    sheet.getRange(C.AGG_FIRST_ROW, C.AGG_FIRST_COL).setFormula(aggregateFormula_(unit, pick, first, last));
    for (let c = C.AGG_FIRST_COL; c < width; c += 2) {
      sheet.getRange(C.AGG_FIRST_ROW, c, C.AGG_ROWS, 1).setFontColor(Style.COLOR.MUTED).setFontSize(9).setHorizontalAlignment('right');
      sheet.getRange(C.AGG_FIRST_ROW, c + 1, C.AGG_ROWS, 1).setNumberFormat(Layout.HM_FORMAT).setFontWeight('bold')
        .setHorizontalAlignment('center');
    }

    // 入力規則：案件はマスタから、工数は刻みと上限を守った数値
    const projectRule = SpreadsheetApp.newDataValidation()
      .requireValueInRange(MasterSheet.pickRange(ss, pick), true)
      .setAllowInvalid(false)
      .setHelpText('案件マスタに登録した案件から選んでください。')
      .build();
    const step = isMin ? stepMin : stepMin / 60;
    const max = isMin ? Layout.DAY_HOURS_MAX * 60 : Layout.DAY_HOURS_MAX;
    const example = isMin ? '1時間半なら 90' : '1時間半なら 1.5';
    for (let i = 0; i < Layout.SLOT_COUNT; i++) {
      sheet.getRange(first, Layout.slotCodeCol(i), days, 1).setDataValidation(projectRule);
      const h = `${a1(Layout.slotHoursCol(i))}${first}`;
      sheet.getRange(first, Layout.slotHoursCol(i), days, 1)
        .setNumberFormat(Layout.INPUT_FORMAT[unit]).setHorizontalAlignment('center')
        .setDataValidation(SpreadsheetApp.newDataValidation()
          .requireFormulaSatisfied(`=AND(ISNUMBER(${h}), ${h}>0, ${h}<=${max}, ABS(${h}/${step}-ROUND(${h}/${step}, 0))<1E-9)`)
          .setAllowInvalid(false)
          .setHelpText(`工数は${unit}で入力してください（${stepMin}分刻み。例: ${example}）。`)
          .build());
    }

    setConditionalRules_(sheet, first, days);

    // 集計欄と見出しの行、日付〜日合計の3列を固定する
    sheet.setFrozenRows(C.HEADER_ROW);
    sheet.setFrozenColumns(C.DAY_TOTAL);
    sheet.setColumnWidth(C.DATE, 56);
    sheet.setColumnWidth(C.DOW, 56);
    sheet.setColumnWidth(C.DAY_TOTAL, 76);
    for (let i = 0; i < Layout.SLOT_COUNT; i++) {
      sheet.setColumnWidth(Layout.slotCodeCol(i), 170);
      sheet.setColumnWidth(Layout.slotHoursCol(i), 84); // 見出し「工数（時間）」が折り返さない幅
    }
    sheet.setColumnWidth(C.NOTE, 220);

    // 入力欄（案件・工数・備考）以外は数式や自動生成なので、編集時に警告を出す
    const protection = sheet.protect().setDescription('日付・合計・集計は自動生成のため編集不可').setWarningOnly(true);
    protection.setUnprotectedRanges([
      sheet.getRange(first, C.FIRST_SLOT, days, Layout.SLOT_COUNT * 2),
      sheet.getRange(first, C.NOTE, days, 1),
    ]);
  };

  /**
   * 案件別集計の数式。マスタの各案件（コード x・案件名 y・略称 z）について全枠の工数を合計し、
   * 工数がある案件だけを「コード：略称（無ければ案件名）, 時:分」の組で横に並べ、
   * 案件枠の数で次の行へ折り返す（1つの数式が展開する。収まらない分は切り捨てる）。
   */
  const aggregateFormula_ = (unit, pick, first, last) => {
    const sep = Layout.LABEL_SEPARATOR;
    const { codes, names, shorts } = MasterSheet.formulaRanges();
    const only = (r) => `FILTER(${r}, ${codes}<>"")`;
    const sums = sumExpr_('', pick, { code: 'x', name: 'y', short: 'z' }, first, last);
    return `=IFERROR(LET(c, ${only(codes)}, n, ${only(names)}, s, ${only(shorts)}, `
      + `h, MAP(c, n, s, LAMBDA(x, y, z, ${toDuration_(unit, sums)})), `
      + `pairs, TOROW(FILTER(HSTACK(c&"${sep}"&IF(s="", n, s), h), h>0)), `
      + `TAKE(WRAPROWS(pairs, ${Layout.SLOT_COUNT * 2}, ""), ${C.AGG_ROWS})), "")`;
  };

  /** 条件付き書式（入力漏れ・日合計の超過・今日の行）。 */
  const setConditionalRules_ = (sheet, first, days) => {
    const rules = [];
    // 案件と工数は2つ揃って1件。片方だけ入っていたら両方を赤くする
    for (let i = 0; i < Layout.SLOT_COUNT; i++) {
      const code = a1(Layout.slotCodeCol(i));
      const hours = a1(Layout.slotHoursCol(i));
      rules.push(SpreadsheetApp.newConditionalFormatRule()
        .whenFormulaSatisfied(`=XOR($${code}${first}<>"", $${hours}${first}<>"")`)
        .setBackground(Style.COLOR.ERROR_BG)
        .setRanges([sheet.getRange(first, Layout.slotCodeCol(i), days, 2)])
        .build());
    }
    // 1日は24時間（時:分の値で1）までなので、超えていたら入力ミス
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenNumberGreaterThan(Layout.DAY_HOURS_MAX / 24)
      .setBackground(Style.COLOR.ERROR_BG)
      .setRanges([sheet.getRange(first, C.DAY_TOTAL, days, 1)])
      .build());
    // 今日の行。日付・曜日は白抜きにして、行全体も色を付ける（先に書いたルールが優先される）
    // 日付に時刻が混ざっていても日付だけで比べる
    const isToday = `=INT($${a1(C.DATE)}${first})=TODAY()`;
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(isToday)
      .setBackground(Style.COLOR.TODAY_MARK_BG).setFontColor(Style.COLOR.TODAY_MARK_FG).setBold(true)
      .setRanges([sheet.getRange(first, C.DATE, days, 2)])
      .build());
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(isToday)
      .setBackground(Style.COLOR.TODAY_BG)
      .setRanges([sheet.getRange(first, 1, days, C.NOTE)])
      .build());
    sheet.setConditionalFormatRules(rules);
  };

  /** サマリが参照するセル（A1形式、シート名付き） */
  const cellRef_ = (name, row, col) => `${Layout.sheetRef(name)}$${a1(col)}$${row}`;
  const totalRef = (name) => cellRef_(name, C.TOTAL_ROW, C.DAY_TOTAL);
  const forecastRef = (name) => cellRef_(name, C.FORECAST_ROW, C.DAY_TOTAL);
  const workDaysRef = (name) => cellRef_(name, C.WORK_DAYS_ROW, C.DAY_TOTAL);

  /**
   * サマリに置く「その月のある案件の工数（時:分）」の数式。
   * 案件別集計は表示の件数に上限があるので、サマリは月シートの入力欄から直接合計する。
   */
  const projectTotalFormula = (sheet, project) => {
    const name = sheet.getName();
    const { unit, pick } = settingsOf(sheet);
    const { first, last } = dayRows_(name);
    const lit = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const keys = { code: lit(project.code), name: lit(project.name), short: lit(project.short) };
    return `=${toDuration_(unit, sumExpr_(Layout.sheetRef(name), pick, keys, first, last))}`;
  };

  /**
   * 入力済みの工数を「1日×1案件」にまとめて返します（同じ日に同じ案件を2枠に入れたら合算）。
   * @param projects MasterSheet.getProjects の戻り値
   * @return [{ date, project, minutes }]（日付順、同じ日はマスタの順）
   */
  const readEntries = (sheet, projects) => {
    const { unit, pick } = settingsOf(sheet);
    const { first, days } = dayRows_(sheet.getName());
    const sep = Layout.LABEL_SEPARATOR;
    const find = {
      [Layout.PICK.LABEL]: (v) => projects.find((p) => v.startsWith(p.code + sep)),
      [Layout.PICK.CODE]: (v) => projects.find((p) => v === p.code),
      [Layout.PICK.NAME]: (v) => projects.find((p) => v === p.name),
      [Layout.PICK.SHORT]: (v) => projects.find((p) => p.short !== '' && v === p.short),
    }[pick];
    const perMinute = unit === Layout.UNIT.MINUTES ? 1 : 60;
    const values = sheet.getRange(first, 1, days, C.NOTE).getValues();
    const entries = [];
    values.forEach((row) => {
      const date = row[C.DATE - 1];
      const perDay = new Map();
      for (let i = 0; i < Layout.SLOT_COUNT; i++) {
        const value = String(row[Layout.slotCodeCol(i) - 1]).trim();
        const hours = row[Layout.slotHoursCol(i) - 1];
        if (!value || typeof hours !== 'number' || hours <= 0) continue;
        const project = find(value);
        if (!project) continue;
        perDay.set(project, (perDay.get(project) || 0) + Math.round(hours * perMinute));
      }
      projects.filter((p) => perDay.has(p)).forEach((p) => entries.push({ date, project: p, minutes: perDay.get(p) }));
    });
    return entries;
  };

  /**
   * 条件付き書式を今の定義で張り直します（作成済みのシートにも、色の変更を作り直さずに反映するため）。
   */
  const refreshRules = (sheet) => {
    const { first, days } = dayRows_(sheet.getName());
    setConditionalRules_(sheet, first, days);
  };

  /**
   * 今日の行の案件1のセルを選択します（開いてすぐ入力できるように）。
   * 今日がその月でなければ何もしない。
   */
  const focusToday = (sheet) => {
    const today = new Date();
    if (sheet.getName() !== nameOf(today)) return;
    sheet.activate();
    sheet.getRange(C.FIRST_DAY_ROW + today.getDate() - 1, C.FIRST_SLOT).activate();
  };

  return {
    nameOf, list, ensure, refreshRules, focusToday, settingsOf, totalRef, forecastRef, workDaysRef, projectTotalFormula, readEntries,
  };
})();
