/**
 * 契約（案件）シートの読み取り。
 *
 * 案件が変わると精算幅も単価も変わるため、契約は「いつからいつまで」で持ちます。
 * サマリの各月は年月から該当する契約を引いて、単価や精算幅を自動で埋めます
 * （毎月同じ値を手入力し直さずに済み、契約を直せば過去の月も一括で計算し直せる）。
 *
 * 時間単価は入力せず、月額単価 ÷ 基準時間 で求めます。
 * 例）月額 750,000円 / 基準時間 160h → 4,687.5 → 端数処理（切り捨て）→ 4,687円
 *
 * 支払額は売上そのものではなく、還元率を掛けた額です。
 * 例）売上 750,000円 × 還元率 70% → 525,000円
 *
 * 精算が無い契約もあるため「精算」列であり／なしを選びます。
 * 「なし」なら下限・上限・基準時間は使わず、売上は月額単価のままになります。
 */
const Contracts = (function () {
  /** 契約シート名 */
  const SHEET = '契約';

  /** 精算の有無。サマリへ渡す値をここで切り替える */
  const SETTLE = { ON: 'あり', OFF: 'なし' };
  const SETTLE_LIST = [SETTLE.ON, SETTLE.OFF];

  /** 端数処理の選択肢。サマリ側の数式もこの文言で分岐する */
  const ROUNDING = {
    DOWN: '切り捨て',
    UP: '切り上げ',
    HALF: '四捨五入',
  };
  const ROUNDING_LIST = [ROUNDING.DOWN, ROUNDING.UP, ROUNDING.HALF];

  /**
   * 丸め単位の選択肢。「何円きざみで丸めるか」を表します。
   *
   * 単位で割って丸め、掛け戻すことで桁を変えます。
   * ほとんどの契約は1円単位なので、よく使う順に並べています。
   */
  const UNIT_LIST = [1, 10, 100, 1000, 0.01];
  /** 未指定のときに使う単位 */
  const UNIT_DEFAULT = 1;
  /** 丸め単位の表示。数字だけだと何の単位か分からないので「円単位」を添える */
  const UNIT_FORMAT = '0.##"円単位"';

  /** 列（1始まり） */
  const COL = {
    NAME: 1,        // 契約名
    FROM: 2,        // 開始年月
    TO: 3,          // 終了年月（空なら継続中）
    MONTHLY: 4,     // 月額単価（円）
    SETTLE: 5,      // 精算（あり / なし）
    LOWER: 6,       // 下限h
    UPPER: 7,       // 上限h
    BASE_H: 8,      // 基準時間h（時間単価の分母）
    ROUND_ADJ: 9,   // 端数処理（超過控除）… 超過控除単価と精算額に効く
    UNIT_ADJ: 10,   // 丸め単位（超過控除）
    HOURLY: 11,     // 超過控除単価（自動計算。入力欄ではない）
    RATE: 12,       // 還元率（売上に対する支払いの割合）
    ROUND_PAY: 13,  // 端数処理（支払）… 支払額に効く
    UNIT_PAY: 14,   // 丸め単位（支払）
  };
  const WIDTH = 14;

  /** 自動計算する列（入力欄ではない） */
  const COMPUTED_COLS = [COL.HOURLY];

  /** 列幅（px）。見出しと入力値がどちらも折り返さずに収まる幅 */
  const COL_WIDTH = [170, 88, 88, 100, 70, 76, 76, 84, 130, 124, 100, 70, 110, 106];

  /** 契約に必ず要る列 */
  const REQUIRED_ALWAYS = [COL.NAME, COL.FROM, COL.MONTHLY, COL.SETTLE, COL.RATE, COL.ROUND_PAY, COL.UNIT_PAY];
  /** 精算ありのときだけ要る列 */
  const REQUIRED_IF_SETTLE = [COL.LOWER, COL.UPPER, COL.BASE_H, COL.ROUND_ADJ, COL.UNIT_ADJ];

  const HEADERS = ['契約名', '開始年月', '終了年月', '月額単価', '精算',
    '下限時間', '上限時間', '基準時間', '端数処理(超過控除)', '丸め単位(超過控除)', '超過控除単価',
    '還元率', '端数処理(支払)', '丸め単位(支払)'];
  const NOTES = [
    '【必須】案件名など。サマリの契約列に表示する',
    '【必須】この契約が始まる年月 yyyyMM',
    'この契約が終わる年月 yyyyMM。空なら継続中',
    '【必須】月額の契約単価（円）。売上の基準になる',
    `【必須】${SETTLE_LIST.join(' / ')}。「なし」なら精算の欄は使わず、売上は月額単価のまま`,
    '【精算ありなら必須】精算幅の下限。これを下回ると控除',
    '【精算ありなら必須】精算幅の上限。これを上回ると超過',
    '【精算ありなら必須】時間単価の分母。月額単価÷基準時間が超過・控除の時間単価になる',
    `【精算ありなら必須】${ROUNDING_LIST.join(' / ')}。超過控除単価と精算額の端数に適用する`,
    '【精算ありなら必須】何円きざみで丸めるか。通常は「1円単位」。'
      + '契約書に「千円未満切り捨て」とあれば1000、「百円単位」とあれば100を選ぶ',
    '【自動計算】月額単価÷基準時間を端数処理した、上限超過と下限割れの両方に使う単価。契約書の超過単価と一致するか確認する欄',
    '【必須】売上に対する支払いの割合。支払額＝売上×還元率。70% なら「70」と入力する（％記号は不要）',
    `【必須】${ROUNDING_LIST.join(' / ')}。支払額（売上×還元率）の端数に適用する。`
      + '超過控除とは別に決められるよう列を分けている',
    '【必須】何円きざみで丸めるか。通常は「1円単位」。'
      + '契約書に「千円未満切り捨て」とあれば1000を選ぶ',
  ];

  /**
   * 旧レイアウトの見出し名 → 今の見出し名。
   * 列を増やしたときに、入力済みの値を正しい列へ移すために使います。
   */
  const HEADER_ALIAS = {
    // 超過控除と支払で扱いが違うため、1つだった端数処理を2つへ複製する
    '端数処理': ['端数処理(超過控除)', '端数処理(支払)'],
    // 何に対する丸めか分かるよう名前を変えた
    '端数処理(精算)': ['端数処理(超過控除)'],
    '時間単価': ['超過控除単価'],
    // 単位の「h」を落として漢字に揃えた
    '下限h': ['下限時間'],
    '上限h': ['上限時間'],
    '基準時間h': ['基準時間'],
  };

  /** 入力欄として残しておく行数（契約はそう多くないので控えめに確保する） */
  const INPUT_ROWS = 20;

  /**
   * 還元率のセルに使う書式。
   *
   * パーセント書式（'0%'）だと、70 と打った値がそのまま 7000% になってしまいます。
   * 代わりに「％」を文字として付ける書式にして、セルの中身は 70 のままにします。
   * 見たまま（70%）と入力（70）が一致するので、％記号を打つ必要がありません。
   */
  const RATE_FORMAT = '0.##"%"';

  /**
   * 契約シートの還元率（パーセント表記）を計算で使う割合に直します。
   * 70 → 0.7 / 100 → 1
   */
  const normRate = (v) => {
    if (v === '' || v === null || v === undefined) return '';
    const n = Number(v);
    if (!isFinite(n)) return '';
    return n / 100;
  };

  /**
   * 還元率の入力値をパーセント表記に揃えます（初期化時の移行用）。
   *
   * 以前はセルがパーセント書式で、中身が 0.7 のような割合で入っていました。
   * 1以下の値はその名残とみなして100倍し、70 として持ち直します
   * （還元率が1%以下という契約は無いため、この判定で取り違えは起きません）。
   */
  const toRateInput = (v) => {
    if (v === '' || v === null || v === undefined) return '';
    const n = Number(v);
    if (!isFinite(n)) return '';
    return (n > 0 && n <= 1) ? n * 100 : n;
  };

  /** 年月の表記ゆれ（2026/04・202604・数値）を 'yyyyMM' に揃えます。 */
  const normYm = (v) => {
    if (v instanceof Date) return DateUtils.formatDate(v, 'yyyyMM');
    return String(v === null || v === undefined ? '' : v).replace(/[^0-9]/g, '').slice(0, 6);
  };

  /** 値が空かどうか */
  const isBlank_ = (v) => v === '' || v === null || v === undefined;

  /**
   * 精算の有無を決めます。
   * 「精算」列が空の契約（この列を足す前に入力されたもの）は、
   * 下限か上限が入っていれば精算ありとみなします。
   */
  const normSettle = (row) => {
    const v = String(row[COL.SETTLE - 1] || '').trim();
    if (v === SETTLE.ON || v === SETTLE.OFF) return v;
    return (!isBlank_(row[COL.LOWER - 1]) || !isBlank_(row[COL.UPPER - 1])) ? SETTLE.ON : SETTLE.OFF;
  };

  /**
   * 入力欄だけを並べたCOUNTAの引数を作ります（例 '$A2:$I2,$K2:$L2'）。
   * 自動計算の列を挟んでも、その手前と後ろに分けて数えられるようにするためです。
   */
  const inputRanges_ = () => {
    const parts = [];
    let from = 0;
    for (let c = 1; c <= WIDTH + 1; c++) {
      const computed = c > WIDTH || COMPUTED_COLS.indexOf(c) >= 0;
      if (computed) {
        if (from) parts.push(`$${SheetLayout.colLetter(from)}2:$${SheetLayout.colLetter(c - 1)}2`);
        from = 0;
      } else if (!from) {
        from = c;
      }
    }
    return parts.join(',');
  };

  /**
   * 時間単価の数式を作ります。
   *
   * 契約書の超過・控除単価と突き合わせられるよう、契約シート上でも計算して見せます。
   * サマリと同じ丸め方（端数処理(精算)に従う）を使うので、値がずれることはありません。
   */
  const hourlyFormula_ = (r) => {
    const c = (col) => `$${SheetLayout.colLetter(col)}${r}`;
    return `=IF(OR(${c(COL.SETTLE)}="${SETTLE.OFF}",${c(COL.MONTHLY)}="",N(${c(COL.BASE_H)})=0),"",`
      + `${SheetLayout.roundedByCell(`${c(COL.MONTHLY)}/${c(COL.BASE_H)}`, c(COL.ROUND_ADJ), c(COL.UNIT_ADJ))})`;
  };

  /**
   * 入力漏れを見つける条件付き書式を作ります。
   *
   * 何も書いていない行まで赤くすると見づらいので、その行に何か入力があるときだけ光らせます。
   */
  const requiredRules_ = (sheet, rowCount) => {
    const T = SheetLayout.THEME;
    const settle = SheetLayout.colLetter(COL.SETTLE);
    // 自動計算の列は数式が入っているぶんCOUNTAで数えられてしまうため、入力欄だけを見る
    const started = `COUNTA(${inputRanges_()})>0`;
    const at = (col) => sheet.getRange(2, col, rowCount, 1);
    const rules = [];

    REQUIRED_ALWAYS.forEach((c) => {
      const letter = SheetLayout.colLetter(c);
      rules.push(SpreadsheetApp.newConditionalFormatRule()
        .whenFormulaSatisfied(`=AND(${started},${letter}2="")`)
        .setBackground(T.REQUIRED)
        .setRanges([at(c)])
        .build());
    });

    REQUIRED_IF_SETTLE.forEach((c) => {
      const letter = SheetLayout.colLetter(c);
      rules.push(SpreadsheetApp.newConditionalFormatRule()
        .whenFormulaSatisfied(`=AND(${started},$${settle}2="${SETTLE.ON}",${letter}2="")`)
        .setBackground(T.REQUIRED)
        .setRanges([at(c)])
        .build());
    });

    // 精算なしの契約では使わない欄なので、入力不要と分かるよう沈める。
    // 値が残っていても読み取らないが、消えたように見えると誤解を招くので文字は薄く残す
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(`=$${settle}2="${SETTLE.OFF}"`)
      .setBackground(T.DISABLED)
      .setFontColor(T.DISABLED_TEXT)
      .setRanges(REQUIRED_IF_SETTLE.concat(COMPUTED_COLS).map((c) => at(c)))
      .build());

    return rules;
  };

  /**
   * 入力済みの契約を、今の列構成に合わせて読み出します。
   *
   * 列の位置ではなく見出し名で対応を取ります。列を増やしたときに
   * 値が隣の列へずれて入るのを防ぐためです（プルダウンや単価が別の列に移ると気づきにくい）。
   */
  const readKept_ = (sheet) => {
    if (sheet.getLastRow() < 2) return [];
    const cols = sheet.getMaxColumns();
    const head = sheet.getRange(1, 1, 1, cols).getValues()[0].map((h) => String(h).trim());
    const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, cols).getValues()
      .filter((r) => r.some((v) => !isBlank_(v)));
    if (!values.length) return [];

    // 旧列 → 今の列（複数へ複製する場合もある）
    const moves = {};
    head.forEach((h, i) => {
      (HEADER_ALIAS[h] || [h]).forEach((name) => {
        const to = HEADERS.indexOf(name);
        if (to >= 0) (moves[i] = moves[i] || []).push(to);
      });
    });

    // 見出しが読み取れないシートは、位置がそのまま対応しているものとして扱う
    if (!Object.keys(moves).length) {
      return values.map((r) => {
        const out = new Array(WIDTH).fill('');
        r.forEach((v, i) => { if (i < WIDTH) out[i] = v; });
        return out;
      });
    }

    return values.map((r) => {
      const out = new Array(WIDTH).fill('');
      r.forEach((v, i) => (moves[i] || []).forEach((to) => { out[to] = v; }));
      return out;
    });
  };

  /** 契約シートを用意します（入力済みの契約はそのまま残す）。 */
  const setup = (ss) => {
    const T = SheetLayout.THEME;
    const sheet = ss.getSheetByName(SHEET) || ss.insertSheet(SHEET);

    // 入力済みの契約を退避してから作り直す
    const kept = readKept_(sheet);
    const rowCount = Math.max(kept.length, INPUT_ROWS);

    // clear() は値と書式しか消さない。入力規則とメモは残るため、
    // 列構成が変わったときに前のレイアウトのプルダウンが別の列へずれて残ってしまう。
    sheet.clear();
    sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).clearDataValidations().clearNote();
    sheet.clearConditionalFormatRules();
    if (sheet.getMaxColumns() < WIDTH) sheet.insertColumnsAfter(sheet.getMaxColumns(), WIDTH - sheet.getMaxColumns());
    if (sheet.getMaxRows() < rowCount + 1) sheet.insertRowsAfter(sheet.getMaxRows(), rowCount + 1 - sheet.getMaxRows());

    sheet.getRange(1, 1, 1, WIDTH).setValues([HEADERS])
      .setFontWeight('bold').setFontColor(T.HEADER_TEXT).setBackground(T.HEADER_CONTRACT)
      .setHorizontalAlignment('center').setVerticalAlignment('middle');
    // ヘッダに説明を入れておく（必須かどうかをシート上で確認できるようにする）
    NOTES.forEach((note, i) => sheet.getRange(1, i + 1).setNote(note));
    sheet.setRowHeight(1, 30);

    if (kept.length) {
      const normalized = kept.map((row) => {
        // 以前は割合（0.7）で持っていた還元率をパーセント表記（70）へ直す
        row[COL.RATE - 1] = toRateInput(row[COL.RATE - 1]);
        // 「精算」列を足す前に入力された契約は、下限・上限の有無から補う
        row[COL.SETTLE - 1] = normSettle(row);
        return row;
      });
      sheet.getRange(2, 1, normalized.length, WIDTH).setValues(normalized);
    }

    const body = sheet.getRange(2, 1, rowCount, WIDTH);
    body.setBackground(T.BODY_INPUT)
      .setBorder(true, true, true, true, true, false, T.BORDER, SpreadsheetApp.BorderStyle.SOLID);
    // 入れなくてもよい欄は白にして、必須欄（薄い黄）と見分けられるようにする
    sheet.getRange(2, COL.TO, rowCount, 1).setBackground(T.OPTIONAL);
    sheet.getRange(2, COL.FROM, rowCount, 2).setNumberFormat('@').setHorizontalAlignment('center');
    sheet.getRange(2, COL.MONTHLY, rowCount, 1).setNumberFormat('#,##0');
    sheet.getRange(2, COL.SETTLE, rowCount, 1).setHorizontalAlignment('center');
    sheet.getRange(2, COL.LOWER, rowCount, 3).setNumberFormat('0.##');
    sheet.getRange(2, COL.RATE, rowCount, 1).setNumberFormat(RATE_FORMAT).setHorizontalAlignment('center');
    sheet.getRange(2, COL.ROUND_ADJ, rowCount, 1).setHorizontalAlignment('center');
    sheet.getRange(2, COL.ROUND_PAY, rowCount, 1).setHorizontalAlignment('center');
    [COL.UNIT_ADJ, COL.UNIT_PAY].forEach((c) => {
      sheet.getRange(2, c, rowCount, 1).setNumberFormat(UNIT_FORMAT).setHorizontalAlignment('center');
    });

    // 時間単価は自動計算。入力欄と色を分けたうえで、数式を入れ直す
    const hourly = sheet.getRange(2, COL.HOURLY, rowCount, 1);
    hourly.setBackground(T.BODY_MONEY).setNumberFormat('#,##0.#').setHorizontalAlignment('right');
    const formulas = [];
    for (let r = 2; r < rowCount + 2; r++) formulas.push([hourlyFormula_(r)]);
    hourly.setFormulas(formulas);

    // プルダウンにして、数式が期待する文言だけが入るようにする
    const list = (values) => SpreadsheetApp.newDataValidation().requireValueInList(values, true).setAllowInvalid(false).build();
    sheet.getRange(2, COL.SETTLE, rowCount, 1).setDataValidation(list(SETTLE_LIST));
    sheet.getRange(2, COL.ROUND_ADJ, rowCount, 1).setDataValidation(list(ROUNDING_LIST));
    sheet.getRange(2, COL.ROUND_PAY, rowCount, 1).setDataValidation(list(ROUNDING_LIST));
    sheet.getRange(2, COL.UNIT_ADJ, rowCount, 1).setDataValidation(list(UNIT_LIST));
    sheet.getRange(2, COL.UNIT_PAY, rowCount, 1).setDataValidation(list(UNIT_LIST));

    // 入力漏れを先に、選択肢の色を後に置く（空欄の警告を色で塗りつぶさないため）
    const rules = requiredRules_(sheet, rowCount)
      .concat(SheetLayout.choiceColorRules(sheet.getRange(2, COL.SETTLE, rowCount, 1), [
        [SETTLE.ON, T.SETTLE_ON],
        [SETTLE.OFF, T.SETTLE_OFF],
      ]))
      .concat(SheetLayout.choiceColorRules(sheet.getRange(2, COL.ROUND_ADJ, rowCount, 1), SheetLayout.roundingChoices()))
      .concat(SheetLayout.choiceColorRules(sheet.getRange(2, COL.ROUND_PAY, rowCount, 1), SheetLayout.roundingChoices()));
    sheet.setConditionalFormatRules(rules);

    sheet.setFrozenRows(1);
    COL_WIDTH.forEach((w, i) => sheet.setColumnWidth(i + 1, w));
    sheet.setHiddenGridlines(true);
    SheetLayout.trim(sheet, rowCount + 1, WIDTH);
    // 入力するのは本文なので、見出しと自動計算の列だけ守る
    SheetLayout.protectRanges(sheet, [
      sheet.getRange(1, 1, 1, WIDTH),
      sheet.getRange(2, COL.HOURLY, rowCount, 1),
    ], SheetLayout.PROTECT_HEADER);
    return sheet;
  };

  /**
   * 契約の一覧を読み込みます（開始年月の昇順）。
   */
  const load = () => {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET);
    if (!sheet || sheet.getLastRow() < 2) return [];

    const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, WIDTH).getValues();
    const list = [];
    values.forEach((v) => {
      const from = normYm(v[COL.FROM - 1]);
      if (from.length !== 6) return; // 開始年月の無い行は無視（メモ書きなど）
      const settle = normSettle(v) === SETTLE.ON;
      list.push({
        name: String(v[COL.NAME - 1] || ''),
        from,
        to: normYm(v[COL.TO - 1]),
        monthly: v[COL.MONTHLY - 1],
        settle,
        // 精算なしの契約は精算幅を空で渡す。サマリ側は下限・上限が空なら
        // はみ出しを見ないため、これだけで「売上＝月額単価」になる
        lower: settle ? v[COL.LOWER - 1] : '',
        upper: settle ? v[COL.UPPER - 1] : '',
        baseHours: settle ? v[COL.BASE_H - 1] : '',
        rate: normRate(v[COL.RATE - 1]),
        // 端数処理と丸め単位は超過控除と支払で別に持つ。精算なしなら超過控除側は使わない
        roundingAdj: settle ? String(v[COL.ROUND_ADJ - 1] || ROUNDING.DOWN) : '',
        unitAdj: settle ? (Number(v[COL.UNIT_ADJ - 1]) || UNIT_DEFAULT) : '',
        roundingPay: String(v[COL.ROUND_PAY - 1] || ROUNDING.DOWN),
        unitPay: Number(v[COL.UNIT_PAY - 1]) || UNIT_DEFAULT,
      });
    });
    list.sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
    return list;
  };

  /**
   * 指定年月に効いている契約を返します。
   * 期間が重なっている場合は開始年月が新しい方を採ります（契約を切り替えた月の扱いを決めるため）。
   * @param list load() の結果
   * @param ym 'yyyyMM'
   * @return 契約 / 見つからなければnull
   */
  const find = (list, ym) => {
    let found = null;
    list.forEach((c) => {
      if (ym < c.from) return;
      if (c.to && ym > c.to) return;
      if (!found || c.from >= found.from) found = c;
    });
    return found;
  };

  return {
    SHEET, COL, WIDTH, COL_WIDTH, COMPUTED_COLS, SETTLE, SETTLE_LIST, ROUNDING, ROUNDING_LIST,
    UNIT_LIST, UNIT_DEFAULT, UNIT_FORMAT,
    HEADERS, REQUIRED_ALWAYS, REQUIRED_IF_SETTLE, inputRanges_, hourlyFormula_,
    RATE_FORMAT, setup, load, find, normYm, normRate, toRateInput, normSettle,
  };
})();
