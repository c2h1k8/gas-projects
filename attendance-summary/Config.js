/**
 * 設定シートの読み書き。
 *
 * 設定をスクリプトプロパティではなくシートに置いています。
 * 勤務表のフォルダIDや集計の基準はGASエディタを開かずに直したいものであり、
 * バインド先のスプレッドシートはgit管理外なのでIDがリポジトリに残る心配もないためです。
 *
 * 単価・精算幅・還元率は案件ごとに変わるので、ここではなく契約シートで持ちます。
 */
const Config = (function () {
  /** 設定項目のキー（設定シートのA列に入る文言） */
  const KEY = {
    DIR_ID: '勤務表フォルダID',
    SHEET_NAME: '勤務表シート名',
    FROM_YM: '集計開始年月',
    STD_HOURS: '所定労働時間(h/日)',
    INCLUDE_LEAVE: '有給・代休の扱い',
    EXCLUDE_NAMES: '対象外のファイル名',
  };

  /**
   * 旧い項目名 → 今の項目名。
   * 項目名を変えても、入力済みの値を引き継げるようにするためのものです。
   */
  const KEY_ALIAS = {
    '有給・代休を稼働時間に含める': KEY.INCLUDE_LEAVE,
  };

  /** 対象外にするファイル名の既定値（テンプレート）。このシート自身はIDで判定して常に除外する */
  const DEFAULT_EXCLUDE = '勤怠管理表_template';

  /**
   * 有給・代休の扱い。
   * TRUE / FALSE より、何がどうなるのかが読んで分かる言葉にしています。
   */
  const LEAVE = { ON: '含める', OFF: '含めない' };
  const LEAVE_LIST = [LEAVE.ON, LEAVE.OFF];

  /** プルダウンにする項目 */
  const CHOICES = {};
  CHOICES[KEY.INCLUDE_LEAVE] = LEAVE_LIST;

  /**
   * 有給・代休の設定値を揃えます。
   * 以前は TRUE / FALSE で持っていたので、その値も読めるようにしています。
   */
  const normLeave_ = (v) => {
    const s = String(v === null || v === undefined ? '' : v).trim();
    if (s === LEAVE.ON) return LEAVE.ON;
    if (s === LEAVE.OFF) return LEAVE.OFF;
    return (v === true || s.toUpperCase() === 'TRUE') ? LEAVE.ON : LEAVE.OFF;
  };

  /** 設定シートの初期内容（項目 / 既定値 / 説明） */
  const TEMPLATE = [
    [KEY.DIR_ID, '', '勤務表が置かれているDriveフォルダのID'],
    [KEY.SHEET_NAME, '', '勤務表のメインシート名'],
    [KEY.FROM_YM, '', '集計を始める年月 yyyyMM。空なら見つかった全ての月'],
    [KEY.STD_HOURS, 8, '1日あたりの所定労働時間。有給・代休を稼働に含める場合の1日分に使う'],
    [KEY.INCLUDE_LEAVE, LEAVE.OFF, `${LEAVE_LIST.join(' / ')}。「${LEAVE.ON}」にすると有給・代休の日を所定労働時間ぶんの稼働として数える`],
    [KEY.EXCLUDE_NAMES, DEFAULT_EXCLUDE, '読み込まないファイル名。カンマ区切りで複数指定できる。このスプレッドシート自身は指定しなくても除外される'],
  ];

  /** 旧い項目名を今の項目名に読み替えます。 */
  const alias_ = (k) => {
    const name = String(k === null || k === undefined ? '' : k).trim();
    return KEY_ALIAS[name] || name;
  };

  /** 入力済みの値の控えを読みます。 */
  const loadBackup_ = () => Props.getJson(PKeys.CONFIG_BACKUP) || {};

  /** 入力済みの値を控えます（空欄は控えない）。 */
  const saveBackup_ = (map) => {
    const keep = {};
    Object.keys(map).forEach((k) => {
      const v = map[k];
      if (v !== '' && v !== null && v !== undefined) keep[k] = v;
    });
    Props.setJson(PKeys.CONFIG_BACKUP, keep);
  };

  /**
   * 設定シートを用意します。
   *
   * 既にある項目の値はそのまま残し、足りない項目だけ足します。
   * さらに、値が空の項目は控えから戻します。シートを作り直したり
   * 行を消したりしても、フォルダIDやシート名を入力し直さずに済むようにするためです。
   */
  const setup = (ss) => {
    const T = SheetLayout.THEME;
    const sheet = ss.getSheetByName(SheetLayout.CONFIG_SHEET) || ss.insertSheet(SheetLayout.CONFIG_SHEET);

    // 今ある入力値を拾う（使わなくなった項目の行はここで捨てる）
    const current = {};
    if (sheet.getLastRow() > 1) {
      sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues()
        .forEach(([k, v]) => { const key = alias_(k); if (key) current[key] = v; });
    }
    const backup = {};
    const saved = loadBackup_();
    Object.keys(saved).forEach((k) => { const key = alias_(k); if (key) backup[key] = saved[k]; });

    // TEMPLATE の順に作り直す。値は「シートの入力 → 控え → 既定値」の順で採る
    const rows = TEMPLATE.map(([key, def, note]) => {
      let value = current[key];
      if (value === '' || value === null || value === undefined) value = backup[key];
      if (value === '' || value === null || value === undefined) value = def;
      // TRUE / FALSE で持っていた頃の値をプルダウンの文言へ直す
      if (key === KEY.INCLUDE_LEAVE) value = normLeave_(value);
      return [key, value, note];
    });

    // clear() は値と書式しか消さないため、入力規則とメモも明示的に落とす
    sheet.clear();
    sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).clearDataValidations().clearNote();
    sheet.clearConditionalFormatRules();
    sheet.getRange(1, 1, 1, 3).setValues([['項目', '値', '説明']])
      .setFontWeight('bold').setFontColor(T.HEADER_TEXT).setBackground(T.HEADER_AUTO)
      .setVerticalAlignment('middle');
    sheet.getRange(2, 1, rows.length, 3).setValues(rows);
    sheet.getRange(2, 1, rows.length, 1).setFontWeight('bold');
    sheet.getRange(2, 2, rows.length, 1).setBackground(T.BODY_INPUT)
      .setBorder(true, true, true, true, true, false, T.BORDER, SpreadsheetApp.BorderStyle.SOLID);
    sheet.getRange(2, 3, rows.length, 1).setFontColor(T.TEXT_MUTED).setFontSize(9);

    // 決まった言葉から選ぶ項目はプルダウンにして、選択肢ごとに色を付ける
    const rules = [];
    rows.forEach(([key], i) => {
      const list = CHOICES[key];
      if (!list) return;
      const cell = sheet.getRange(i + 2, 2);
      cell.setDataValidation(SpreadsheetApp.newDataValidation()
        .requireValueInList(list, true).setAllowInvalid(false).build())
        .setHorizontalAlignment('center');
      rules.push.apply(rules, SheetLayout.choiceColorRules(cell, [
        [LEAVE.ON, T.SETTLE_ON],
        [LEAVE.OFF, T.SETTLE_OFF],
      ]));
    });
    if (rules.length) sheet.setConditionalFormatRules(rules);

    // 所定労働時間はサマリの残業時間の数式から参照するので、名前定義を張り直す
    const stdRow = rows.findIndex(([key]) => key === KEY.STD_HOURS);
    if (stdRow >= 0) ss.setNamedRange(SheetLayout.NAMED_STD_HOURS, sheet.getRange(stdRow + 2, 2));

    sheet.setRowHeight(1, 30);
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 230);
    sheet.setColumnWidth(2, 180);
    sheet.setColumnWidth(3, 560);
    sheet.setHiddenGridlines(true);
    SheetLayout.trim(sheet, rows.length + 1, 3);
    // 編集するのは「値」の列だけなので、見出し・項目名・説明を守る
    SheetLayout.protectRanges(sheet, [
      sheet.getRange(1, 1, 1, 3),
      sheet.getRange(2, 1, rows.length, 1),
      sheet.getRange(2, 3, rows.length, 1),
    ], SheetLayout.PROTECT_HEADER);
    return sheet;
  };

  /**
   * 設定を読み込みます。
   * 行を並べ替えても壊れないよう、行番号ではなく項目名で引きます。
   */
  const load = () => {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SheetLayout.CONFIG_SHEET);
    if (!sheet) throw new Error(`「${SheetLayout.CONFIG_SHEET}」シートがありません。メニューの「シート初期化」を実行してください。`);

    const last = sheet.getLastRow();
    const map = {};
    if (last >= 2) {
      sheet.getRange(2, 1, last - 1, 2).getValues().forEach(([k, v]) => { map[alias_(k)] = v; });
    }

    const num = (key, def) => {
      const v = map[key];
      return (v === '' || v === null || v === undefined) ? def : Number(v);
    };
    const str = (key) => String(map[key] === undefined || map[key] === null ? '' : map[key]).trim();

    const cfg = {
      dirId: str(KEY.DIR_ID),
      sheetName: str(KEY.SHEET_NAME),
      fromYm: str(KEY.FROM_YM).replace(/[^0-9]/g, '').slice(0, 6),
      stdHours: num(KEY.STD_HOURS, 8),
      includeLeave: normLeave_(map[KEY.INCLUDE_LEAVE]) === LEAVE.ON,
      excludeNames: str(KEY.EXCLUDE_NAMES).split(',').map((s) => s.trim()).filter((s) => s),
    };

    if (!cfg.dirId) throw new Error(`設定シートの「${KEY.DIR_ID}」を入力してください。`);
    if (!cfg.sheetName) throw new Error(`設定シートの「${KEY.SHEET_NAME}」を入力してください。`);

    // シートを作り直したときに戻せるよう控えておく
    saveBackup_(map);
    return cfg;
  };

  return { KEY, LEAVE, LEAVE_LIST, setup, load };
})();
