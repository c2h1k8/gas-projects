/**
 * サマリシートのレイアウト定義。
 *
 * 列番号・ヘッダ・書式・数式をここに集約し、他のモジュールは COL の名前だけを使います。
 * 列を増減するときはこのファイルだけを直せば済むようにするためです。
 *
 * サマリに手入力欄はありません。勤務表（実績）と契約シート（単価・精算幅・還元率）から
 * すべて導けるため、値の入力元をその2つに寄せています。
 */
const SheetLayout = (function () {
  /** サマリシート名 */
  const SUMMARY_SHEET = 'サマリ';
  /** 設定シート名 */
  const CONFIG_SHEET = '設定';
  /** 見出しの行数（1段目＝ブロック名、2段目＝列名） */
  const HEADER_ROWS = 2;
  /** データの開始行 */
  const DATA_START_ROW = HEADER_ROWS + 1;
  /** 日別列の日数（月の最大日数） */
  const MAX_DAYS = 31;

  /**
   * 列番号（1始まり）。
   * 左から「集計 → 契約 → 金額 → メタ → 日別」の順に並べ、
   * 金額の確認に使う列が横スクロールなしで見えるようにしています。
   */
  const COL = {
    YM: 1,             // 年月（'yyyy/MM' の文字列）
    CONTRACT: 2,       // 契約名
    WORK_DAYS: 3,      // 稼働日数
    PAID: 4,           // 有給
    ABSENT: 5,         // 欠勤
    DAIKYU: 6,         // 代休
    HOLIDAY_WORK: 7,   // 休日出勤
    WORK_H: 8,         // 稼働時間（精算の元。過去月＝実績、当月＝着地見込み）
    DAY_AVG: 9,        // 日平均
    OVERTIME: 10,      // 残業時間（稼働時間 − 稼働日数×所定労働時間）
    ACTUAL_H: 11,      // 実績時間（当日まで。非表示。日平均の分母に使う）

    // ここから契約シート由来。年月から該当契約を引いて自動で埋める
    MONTHLY: 12,       // 月額単価
    LOWER: 13,         // 下限時間
    UPPER: 14,         // 上限時間
    BASE_H: 15,        // 基準時間
    ROUND_ADJ: 16,     // 端数処理（超過控除）… 超過控除単価と精算額に効く
    UNIT_ADJ: 17,      // 丸め単位（超過控除）
    RATE: 18,          // 還元率
    ROUND_PAY: 19,     // 端数処理（支払）… 支払額に効く
    UNIT_PAY: 20,      // 丸め単位（支払）

    HOURLY: 21,        // 超過控除単価（月額単価÷基準時間）
    DIFF_H: 22,        // 過不足時間
    ADJUST: 23,        // 精算額
    REVENUE: 24,       // 売上（月額単価＋精算額）
    PAYMENT: 25,       // 支払額（売上×還元率）

    LINK_OPEN: 26,     // 勤務表を開くリンク
    LINK_XLSX: 27,     // 勤務表をxlsxで落とすリンク
    FILE_CREATED: 28,  // 勤務表 作成日
    FILE_UPDATED: 29,  // 勤務表 最終更新
    IMPORTED_AT: 30,   // 取込日時
    FILE_ID: 31,       // 勤務表ファイルID（非表示・リンクと差分判定のキー）

    DAY_START: 32,     // 日別の先頭列（1日）
  };

  /** 日別を含めた総列数 */
  const TOTAL_COLS = COL.DAY_START + MAX_DAYS - 1;

  /** 契約シートから毎回埋め直す列 */
  const CONTRACT_COLS = [COL.CONTRACT, COL.MONTHLY, COL.LOWER, COL.UPPER, COL.BASE_H,
    COL.ROUND_ADJ, COL.UNIT_ADJ, COL.RATE, COL.ROUND_PAY, COL.UNIT_PAY];

  /**
   * 列幅（px）。見出しと中身のどちらも折り返さずに収まる幅にしています。
   * 金額列は7桁＋桁区切りが入る前提、日時列は 'yyyy/MM/dd HH:mm' が入る前提です。
   */
  const WIDTH = {
    [COL.YM]: 72,
    [COL.CONTRACT]: 130,
    [COL.WORK_DAYS]: 66,
    [COL.PAID]: 46,
    [COL.ABSENT]: 46,
    [COL.DAIKYU]: 46,
    [COL.HOLIDAY_WORK]: 46,
    [COL.WORK_H]: 78,
    [COL.DAY_AVG]: 62,
    [COL.OVERTIME]: 78,
    [COL.ACTUAL_H]: 74,
    [COL.MONTHLY]: 88,
    [COL.LOWER]: 72,
    [COL.UPPER]: 72,
    [COL.BASE_H]: 76,
    [COL.ROUND_ADJ]: 130,
    [COL.UNIT_ADJ]: 124,
    [COL.RATE]: 62,
    [COL.ROUND_PAY]: 110,
    [COL.UNIT_PAY]: 106,
    [COL.HOURLY]: 78,
    [COL.DIFF_H]: 84,
    [COL.ADJUST]: 88,
    [COL.REVENUE]: 92,
    [COL.PAYMENT]: 96,
    [COL.LINK_OPEN]: 58,
    [COL.LINK_XLSX]: 96,
    [COL.FILE_CREATED]: 118,
    [COL.FILE_UPDATED]: 118,
    [COL.IMPORTED_AT]: 118,
    [COL.FILE_ID]: 120,
  };
  /** 日別1列ぶんの幅。'10.50' が切れずに収まる最小幅 */
  const DAY_WIDTH = 42;
  /** 日別の文字サイズ。31列並ぶので本文より一段小さくする */
  const DAY_FONT_SIZE = 9;
  /** データ行の高さ。既定の21pxだと詰まって見える */
  const ROW_HEIGHT = 26;

  /**
   * 隠しておく列。
   *
   * 数式が参照するので列そのものは要るが、金額の確認には出ていなくてよいものです。
   * 消さずに隠すのは、計算根拠を追いたくなったときに表示すれば見られるようにするためです。
   */
  const HIDDEN_COLS = [COL.ACTUAL_H, COL.LOWER, COL.UPPER, COL.BASE_H, COL.ROUND_ADJ, COL.UNIT_ADJ,
    COL.RATE, COL.ROUND_PAY, COL.UNIT_PAY, COL.FILE_ID];

  /** 所定労働時間を数式から参照するための名前定義（設定シートの値を指す） */
  const NAMED_STD_HOURS = 'STD_HOURS';
  /** この残業時間（月）を超えた行を警告色にする。36協定の目安 */
  const OVERTIME_ALERT = 45;

  /**
   * 見出し1段目に置くブロック。
   *
   * どの列がどのまとまりかを、色ではなく言葉で示します。
   * 年月と日別はブロック名を持たず、列名を2段ぶんの高さで縦に結合して見せます
   * （日別は31列と幅が広いため、結合した見出しだと横スクロールで画面外へ出てしまう）。
   */
  const HEADER_GROUPS = () => [
    { label: '勤務実績', from: COL.WORK_DAYS, to: COL.ACTUAL_H, accent: THEME.ACCENT_SUM },
    // 超過控除単価は月額単価÷基準時間で決まる契約側の単価なので、精算結果ではなく契約条件に含める
    { label: '契約条件', from: COL.MONTHLY, to: COL.HOURLY, accent: THEME.ACCENT_CONTRACT },
    { label: '精算と支払', from: COL.DIFF_H, to: COL.PAYMENT, accent: THEME.ACCENT_MONEY },
    { label: '勤務表', from: COL.LINK_OPEN, to: COL.FILE_ID, accent: THEME.ACCENT_META },
  ];

  /**
   * ブロックの先頭列。ここに縦罫を入れて区切りを示す。
   * 年月・契約（行の見出し）と勤務実績の間にも引く。
   */
  const BLOCK_STARTS = () => [COL.WORK_DAYS, COL.MONTHLY, COL.DIFF_H, COL.LINK_OPEN, COL.DAY_START];

  /** スプレッドシートのURLの共通部分（リンク列の組み立てに使う） */
  const SS_URL = 'https://docs.google.com/spreadsheets/d/';

  /** 保護の説明。付け直すときの目印になるので、シートごとに変えない */
  const PROTECT_SUMMARY = 'サマリは自動生成のため編集不可';
  const PROTECT_HEADER = '見出しは編集不可';

  /**
   * 配色。
   *
   * 見出しは濃色＋白字で締め、本文はブロックごとに淡く色を敷いて由来を見分けます。
   * 日別の色は31列ぶん並ぶため、彩度を落として数字の読みやすさを優先しています。
   */
  const THEME = {
    /** 見出しの文字色 */
    HEADER_TEXT: '#f8fafc',
    /** 見出し2段目（列名）の地色。ブロックごとに変えず1色で通す */
    HEADER_AUTO: '#1e293b',
    HEADER_CONTRACT: '#1e293b',
    HEADER_MONEY: '#1e293b',
    HEADER_META: '#1e293b',
    HEADER_DAY: '#1e293b',
    /** 見出し1段目（ブロック名）の地色と文字色 */
    HEADER_GROUP: '#0f172a',
    HEADER_GROUP_TEXT: '#cbd5e1',

    /** ブロックを示すアクセント罫。塗り面積を小さくして識別だけを残す */
    ACCENT_SUM: '#94a3b8',
    ACCENT_CONTRACT: '#a5b4fc',
    ACCENT_MONEY: '#5eead4',
    ACCENT_META: '#64748b',
    ACCENT_DAY: '#94a3b8',

    /** 本文：沈める列（メタ・自動計算） */
    BODY_META: '#f8fafc',
    BODY_MONEY: '#f8fafc',
    /** 本文：手入力欄（設定・契約シート） */
    BODY_INPUT: '#fffbeb',

    /** ブロックの区切り線 */
    BORDER: '#cbd5e1',
    /** 行の区切り線 */
    ROW_LINE: '#f1f5f9',
    /** 数字を落ち着かせるための文字色 */
    TEXT_MUTED: '#64748b',
    /** 日別の文字色。31列並ぶので黒より一段落とす */
    DAY_TEXT: '#475569',
    /** リンクの文字色。既定の青は他の色と合わないので、金額側のアクセントに寄せる */
    LINK: '#0f766e',

    /** 端数処理：切り捨て */
    ROUND_DOWN: '#eff6ff',
    /** 端数処理：切り上げ */
    ROUND_UP: '#fff7ed',
    /** 端数処理：四捨五入 */
    ROUND_HALF: '#ecfdf5',

    /** 入力が要るのに空の欄 */
    REQUIRED: '#fee2e2',
    /** 入れても入れなくてもよい欄 */
    OPTIONAL: '#ffffff',
    /** その契約では使わない欄 */
    DISABLED: '#f1f5f9',
    /** 使わない欄の文字（消さずに沈める） */
    DISABLED_TEXT: '#94a3b8',
    /** 精算あり */
    SETTLE_ON: '#ecfdf5',
    /** 精算なし */
    SETTLE_OFF: '#f1f5f9',

    /** 残業が目安を超えた月 */
    ALERT: '#ffe4e6',
    /** 同上の文字色 */
    ALERT_TEXT: '#be123c',

    /** 年計行。データ行とわずかに差が出る程度の淡い地色にとどめる */
    YEAR_BG: '#f1f5f9',
    YEAR_TEXT: '#0f172a',
    YEAR_RULE: '#1e293b',
  };

  /** 日別セルの背景色。31列並ぶので彩度を落として数字を主役にする */
  const BG = {
    /** 土日・祝日 */
    HOLIDAY: '#f8fafc',
    /** その月に存在しない日（2月の30日など） */
    NONE: '#e2e8f0',
    /** 有給休暇 */
    PAID: '#ecfdf5',
    /** 代休 */
    DAIKYU: '#fffbeb',
    /** 欠勤 */
    ABSENT: '#fff1f2',
    /** 通常の営業日 */
    NORMAL: '#ffffff',
  };

  /** ヘッダの定義（列番号順） */
  const HEADERS = (() => {
    const h = [];
    h[COL.YM] = '年月';
    h[COL.CONTRACT] = '契約';
    h[COL.WORK_DAYS] = '稼働日数';
    h[COL.PAID] = '有給';
    h[COL.ABSENT] = '欠勤';
    h[COL.DAIKYU] = '代休';
    h[COL.HOLIDAY_WORK] = '休出';
    h[COL.WORK_H] = '稼働時間';
    h[COL.DAY_AVG] = '日平均';
    h[COL.OVERTIME] = '残業時間';
    h[COL.ACTUAL_H] = '実績時間';
    h[COL.MONTHLY] = '月額単価';
    h[COL.LOWER] = '下限時間';
    h[COL.UPPER] = '上限時間';
    h[COL.BASE_H] = '基準時間';
    h[COL.ROUND_ADJ] = '端数処理(超過控除)';
    h[COL.UNIT_ADJ] = '丸め単位(超過控除)';
    h[COL.RATE] = '還元率';
    h[COL.ROUND_PAY] = '端数処理(支払)';
    h[COL.UNIT_PAY] = '丸め単位(支払)';
    h[COL.HOURLY] = '超過控除単価';
    h[COL.DIFF_H] = '過不足時間';
    h[COL.ADJUST] = '精算額';
    h[COL.REVENUE] = '売上';
    h[COL.PAYMENT] = '支払額';
    h[COL.LINK_OPEN] = '開く';
    h[COL.LINK_XLSX] = 'ダウンロード';
    h[COL.FILE_CREATED] = '作成日';
    h[COL.FILE_UPDATED] = '最終更新';
    h[COL.IMPORTED_AT] = '取込日時';
    h[COL.FILE_ID] = 'ファイルID';
    for (let d = 1; d <= MAX_DAYS; d++) h[COL.DAY_START + d - 1] = String(d);
    return h.slice(1); // 1始まりの穴埋めを落として0始まりの配列にする
  })();

  /** 列番号をA1形式の列名に変換します（26列を超えるため2文字に対応）。 */
  const colLetter = (col) => {
    let n = col;
    let s = '';
    while (n > 0) {
      const mod = (n - 1) % 26;
      s = String.fromCharCode(65 + mod) + s;
      n = Math.floor((n - mod) / 26);
    }
    return s;
  };

  /** 列名のショートカット（数式の組み立て用） */
  const L = {};
  Object.keys(COL).forEach((k) => { L[k] = colLetter(COL[k]); });

  /**
   * 端数処理の分岐を付けた数式を組み立てます。
   *
   * 契約ごとに切り捨て／切り上げ／四捨五入が変わるため、行の端数処理列で分岐させます。
   * 端数が出る場面は「時間単価と精算額」と「支払額」の2つで、契約上の扱いが別なので
   * どちらに従うかを列で指定します。未指定は切り捨て扱い。
   *
   * @param expr 丸める式
   * @param r 行番号
   * @param col どの端数処理に従うか（ROUND_ADJ=精算 / ROUND_PAY=支払）
   */
  const rounded = (expr, r, modeCol, unitCol) =>
    roundedByCell(expr, `$${colLetter(modeCol)}${r}`, `$${colLetter(unitCol)}${r}`);

  /**
   * 端数処理の分岐を、指定したセルの値で行う数式にします。
   * 契約シートからも同じ丸め方を使えるよう、参照先をセル指定で受け取ります。
   *
   * 丸める桁は「丸め単位」で決めます。単位で割って丸め、掛け戻すことで、
   * 1円単位でも千円単位でも銭単位でも同じ式で扱えます。単位が空なら1円単位。
   *
   * @param expr 丸める式
   * @param modeCell 端数処理が入っているセル（例 '$I2'）
   * @param unitCell 丸め単位が入っているセル（例 '$J2'）
   */
  const roundedByCell = (expr, modeCell, unitCell) => {
    // 丸め単位は「1円単位」のような言葉で入っているので、数値に戻してから使う。
    // 単位で割った後に小数6桁へ丸めてから端数処理する。
    // 703,130×0.7 が 492,190.99999… と評価されるような浮動小数の誤差があり、
    // そのまま切り捨てると1円ずれるため。
    const unit = `IFERROR(VALUE(SUBSTITUTE(${unitCell},"${Contracts.UNIT_SUFFIX}","")),1)`;
    return `LET(u,${unit},v,ROUND((${expr})/u,6),`
      + `IF(${modeCell}="${Contracts.ROUNDING.UP}",ROUNDUP(v),`
      + `IF(${modeCell}="${Contracts.ROUNDING.HALF}",ROUND(v),ROUNDDOWN(v)))*u)`;
  };

  /**
   * 指定行の数式を組み立てます。
   *
   * 計算過程をシート上に残したいので、金額はスクリプトで計算せず数式で持ちます
   * （なぜその支払額になるのかをシートだけで追える）。
   * @param row 行番号
   * @return { 列番号: 数式 }
   */
  const formulasFor = (row) => {
    const r = row;
    const f = {};

    // 日平均＝実績時間 ÷ 稼働日数
    f[COL.DAY_AVG] = `=IF(N($${L.WORK_DAYS}${r})=0,"",ROUND($${L.ACTUAL_H}${r}/$${L.WORK_DAYS}${r},2))`;

    // 残業時間＝実績時間 −（稼働日数 × 所定労働時間）。
    //
    // 稼働時間ではなく実績時間を使う。稼働時間は当月だと月末までの見込みが入るのに対し、
    // 稼働日数は今日までの出勤日数なので、そのまま引くと分子だけ先の期間を含んでしまい
    // 残業が大きく出てしまうため。実績どうしで引けば、当月は「今日までの残業」になる。
    //
    // 有給・欠勤・代休の日は所定にも実働にも数えず、休日出勤の時間は全額が残業側に乗る。
    // LINE勤怠Bot側の残業計算と同じ定義にして、両者の数字が食い違わないようにしている。
    f[COL.OVERTIME] = `=IF(OR($${L.ACTUAL_H}${r}="",N($${L.WORK_DAYS}${r})=0),"",`
      + `ROUND($${L.ACTUAL_H}${r}-$${L.WORK_DAYS}${r}*${NAMED_STD_HOURS},2))`;

    // 時間単価＝月額単価 ÷ 基準時間（例: 750,000 / 160h → 4,687.5 → 切り捨て → 4,687）
    f[COL.HOURLY] = `=IF(OR($${L.MONTHLY}${r}="",N($${L.BASE_H}${r})=0),"",${rounded(`$${L.MONTHLY}${r}/$${L.BASE_H}${r}`, r, COL.ROUND_ADJ, COL.UNIT_ADJ)})`;

    // 過不足h＝精算幅（下限〜上限）からのはみ出し。幅の中なら0。
    // 稼働時間には、過去月なら実績、進行中の月なら着地見込みが入っている。
    f[COL.DIFF_H] = `=IF(OR($${L.LOWER}${r}="",$${L.UPPER}${r}="",$${L.WORK_H}${r}=""),"",`
      + `IF($${L.WORK_H}${r}<$${L.LOWER}${r},$${L.WORK_H}${r}-$${L.LOWER}${r},`
      + `IF($${L.WORK_H}${r}>$${L.UPPER}${r},$${L.WORK_H}${r}-$${L.UPPER}${r},0)))`;

    // 精算額＝過不足h × 時間単価（不足はマイナスなので控除になる）
    f[COL.ADJUST] = `=IF(OR($${L.DIFF_H}${r}="",$${L.HOURLY}${r}=""),"",${rounded(`$${L.DIFF_H}${r}*$${L.HOURLY}${r}`, r, COL.ROUND_ADJ, COL.UNIT_ADJ)})`;

    // 売上＝月額単価＋精算額（発注元に請求される額）
    f[COL.REVENUE] = `=IF($${L.MONTHLY}${r}="","",$${L.MONTHLY}${r}+IF($${L.ADJUST}${r}="",0,$${L.ADJUST}${r}))`;

    // 支払額＝売上×還元率（手取りとして支払われるはずの額）
    f[COL.PAYMENT] = `=IF(OR($${L.REVENUE}${r}="",$${L.RATE}${r}=""),"",${rounded(`$${L.REVENUE}${r}*$${L.RATE}${r}`, r, COL.ROUND_PAY, COL.UNIT_PAY)})`;

    // 勤務表へのリンク（以下は行内で完結するので順序は関係ない）。ファイルIDから組み立てるので、取り込み直しても貼り直しが要らない
    const id = `$${L.FILE_ID}${r}`;
    f[COL.LINK_OPEN] = `=IF(${id}="","",HYPERLINK("${SS_URL}"&${id}&"/edit","開く"))`;
    // xlsx形式でのダウンロード。スプレッドシートのエクスポートURLで、押すとその場で落ちてくる
    f[COL.LINK_XLSX] = `=IF(${id}="","",HYPERLINK("${SS_URL}"&${id}&"/export?format=xlsx","ダウンロード"))`;

    return f;
  };

  /**
   * 年計行の内容を組み立てます。
   *
   * その年の月が何行目から何行目かを受け取り、合計を数式で持たせます。
   * スクリプトで足した値を書くと、月の行を直したときに合計だけ古くなるためです。
   *
   * @param year 'yyyy'
   * @param from その年の最初の月の行番号
   * @param to その年の最後の月の行番号
   * @return { 列番号: 値または数式 }
   */
  const yearRowFor = (year, from, to) => {
    const sum = (col) => `SUM($${colLetter(col)}${from}:$${colLetter(col)}${to})`;
    const v = {};
    v[COL.YM] = `${year}年`;
    [COL.WORK_DAYS, COL.PAID, COL.ABSENT, COL.DAIKYU, COL.HOLIDAY_WORK,
      COL.WORK_H, COL.OVERTIME, COL.ACTUAL_H].forEach((c) => { v[c] = `=${sum(c)}`; });
    v[COL.DAY_AVG] = `=IF(${sum(COL.WORK_DAYS)}=0,"",ROUND(${sum(COL.ACTUAL_H)}/${sum(COL.WORK_DAYS)},2))`;
    [COL.ADJUST, COL.REVENUE, COL.PAYMENT].forEach((c) => { v[c] = `=${sum(c)}`; });
    return v;
  };

  /**
   * 見込みで計算している行の稼働時間を、確定値と見分けられるようにします。
   * 進行中の月は未来の営業日の予定を含んだ値なので、そのまま同じ見た目だと
   * 確定した過去月と取り違えるためです。
   */
  const styleForecastCells = (sheet, rowNumbers) => {
    rowNumbers.forEach((r) => {
      sheet.getRange(r, COL.WORK_H).setFontStyle('italic').setFontColor(THEME.TEXT_MUTED);
    });
  };

  /**
   * 年計行の見た目を整えます。
   * 塗りつぶすと表組みが重くなるので、上に濃い罫を引いて太字にするだけにします。
   */
  const styleYearRows = (sheet, rowNumbers) => {
    rowNumbers.forEach((r) => {
      // 行全体を淡く塗る。濃くすると見出しと見分けがつかなくなるので、
      // データ行との差が分かる程度にとどめる。
      // 残業の警告色は年計行では文字色だけを変えるので、この地色は途切れない。
      sheet.getRange(r, 1, 1, TOTAL_COLS)
        .setBackground(THEME.YEAR_BG).setFontColor(THEME.YEAR_TEXT).setFontWeight('bold')
        .setBorder(true, null, null, null, null, null, THEME.YEAR_RULE, SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
      sheet.getRange(r, COL.YM).setHorizontalAlignment('left');
    });
  };

  /**
   * 年ごとに行グループを作り、月の行を折りたためるようにします。
   * グループ操作は状態が残るため、作り直す前に一度浅くしてから付け直します。
   * @param ranges [{ from, count }] 折りたたむ月の行
   */
  const groupRows = (sheet, ranges) => {
    try {
      const n = sheet.getMaxRows() - DATA_START_ROW + 1;
      if (n > 0) sheet.getRange(DATA_START_ROW, 1, n, 1).shiftRowGroupDepth(-1);
    } catch (e) {
      // まだグループが無い場合。付ける前の掃除なので失敗しても構わない
    }
    ranges.forEach((g) => {
      try {
        sheet.getRange(g.from, 1, g.count, 1).shiftRowGroupDepth(1);
      } catch (e) {
        Logger.log('[SheetLayout] 行グループを作れませんでした: %s', e.message);
      }
    });
  };

  /**
   * データ範囲へ書式を適用します。
   * 行数が変わるたびに呼ぶので、範囲を指定して都度あてます。
   * @param sheet サマリシート
   * @param rowCount データ行数
   */
  const applyFormats = (sheet, rowCount) => {
    if (rowCount <= 0) return;
    const at = (col, width = 1) => sheet.getRange(DATA_START_ROW, col, rowCount, width);

    // 年月は '2026/08' が日付として解釈されないよう文字列で持つ
    at(COL.YM).setNumberFormat('@');
    at(COL.CONTRACT).setNumberFormat('@');
    at(COL.WORK_DAYS, 5).setNumberFormat('0');
    at(COL.WORK_H, COL.ACTUAL_H - COL.WORK_H + 1).setNumberFormat('0.00');
    at(COL.MONTHLY).setNumberFormat('#,##0');
    at(COL.LOWER, 3).setNumberFormat('0.00');
    at(COL.ROUND_ADJ).setNumberFormat('@');
    at(COL.UNIT_ADJ).setNumberFormat('@');
    // サマリは計算に使う割合（0.7）を持つのでパーセント書式でよい（入力欄ではないため）
    at(COL.RATE).setNumberFormat('0%');
    at(COL.ROUND_PAY).setNumberFormat('@');
    at(COL.UNIT_PAY).setNumberFormat('@');
    // 時間単価は割り切れない契約もあるため小数1桁まで見せる
    at(COL.HOURLY).setNumberFormat('#,##0.#');
    at(COL.DIFF_H).setNumberFormat('0.00');
    at(COL.ADJUST, COL.PAYMENT - COL.ADJUST + 1).setNumberFormat('#,##0');
    at(COL.FILE_CREATED, 3).setNumberFormat('yyyy/MM/dd HH:mm');
    at(COL.FILE_ID).setNumberFormat('@');
    at(COL.DAY_START, MAX_DAYS).setNumberFormat('0.00').setFontSize(DAY_FONT_SIZE);
    // リンクは既定の青・既定サイズだと浮くので、メタ列の文字サイズに揃えて色を当て直す
    at(COL.LINK_OPEN, COL.LINK_XLSX - COL.LINK_OPEN + 1)
      .setHorizontalAlignment('center').setFontSize(9).setFontColor(THEME.LINK);

    // 地色は敷かない。白のままにして、区切りは罫線と余白で示す。
    // 沈めるのはメタ列だけ（内容を追う場面が少ないため）。
    at(COL.LINK_OPEN, COL.FILE_ID - COL.LINK_OPEN + 1).setBackground(THEME.BODY_META);
    at(COL.FILE_CREATED, COL.IMPORTED_AT - COL.FILE_CREATED + 1)
      .setFontColor(THEME.TEXT_MUTED).setFontSize(9);
    at(COL.DAY_START, MAX_DAYS).setFontColor(THEME.DAY_TEXT);

    // 支払額は結論なので太字にして視線が止まるようにする
    at(COL.PAYMENT).setFontWeight('bold');

    // 行の区切りは細い横罫だけ。塗り分けないぶん、行が追えるようにする
    sheet.getRange(DATA_START_ROW, 1, rowCount, TOTAL_COLS)
      .setBorder(null, null, null, null, null, true, THEME.ROW_LINE, SpreadsheetApp.BorderStyle.SOLID);

    // ブロックの境目に縦線を入れる（見出しから本文までを通す）
    BLOCK_STARTS().forEach((c) => {
      sheet.getRange(1, c, rowCount + HEADER_ROWS, 1)
        .setBorder(null, true, null, null, null, null, THEME.BORDER, SpreadsheetApp.BorderStyle.SOLID);
    });

    applyRoundingColors(sheet, DATA_START_ROW, COL.ROUND_ADJ, rowCount);
    applyRoundingColors(sheet, DATA_START_ROW, COL.ROUND_PAY, rowCount);
  };

  /**
   * 選択肢ごとの色付けルールを作ります（プルダウンの値が色で見分けられる）。
   * @param range 対象範囲
   * @param pairs [[選択肢, 背景色], ...]
   */
  const choiceColorRules = (range, pairs) => pairs.map(([text, color]) =>
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(text)
      .setBackground(color)
      .setRanges([range])
      .build());

  /** 端数処理の選択肢と色 */
  const roundingChoices = () => [
    [Contracts.ROUNDING.DOWN, THEME.ROUND_DOWN],
    [Contracts.ROUNDING.UP, THEME.ROUND_UP],
    [Contracts.ROUNDING.HALF, THEME.ROUND_HALF],
  ];

  /**
   * 残業が目安を超えた行を警告色にします（健康管理・36協定）。
   *
   * 月の行は背景と文字色の両方を変えますが、年計行は文字色だけにします。
   * 年計行は見出しとして地色を敷いているので、1セルだけ背景が変わると浮いて見えるためです。
   *
   * @param monthRanges 月の行の範囲 [{ from, count }]
   * @param yearRows 年計行の行番号
   */
  const applyOvertimeAlert = (sheet, monthRanges, yearRows) => {
    // この列に対する既存ルールを外してから入れ直す
    const kept = sheet.getConditionalFormatRules()
      .filter((rule) => !rule.getRanges().every((r) => r.getColumn() === COL.OVERTIME));

    const months = (monthRanges || []).map((g) => sheet.getRange(g.from, COL.OVERTIME, g.count, 1));
    if (months.length) {
      kept.push(SpreadsheetApp.newConditionalFormatRule()
        .whenNumberGreaterThan(OVERTIME_ALERT)
        .setBackground(THEME.ALERT)
        .setFontColor(THEME.ALERT_TEXT)
        .setRanges(months)
        .build());
    }

    const years = (yearRows || []).map((r) => sheet.getRange(r, COL.OVERTIME));
    if (years.length) {
      kept.push(SpreadsheetApp.newConditionalFormatRule()
        .whenNumberGreaterThan(OVERTIME_ALERT)
        .setFontColor(THEME.ALERT_TEXT)
        .setRanges(years)
        .build());
    }

    sheet.setConditionalFormatRules(kept);
  };

  /**
   * 端数処理の値ごとに色を付けます。
   * 条件付き書式は積み上がると重くなるため、対象範囲のルールだけ入れ替えます。
   */
  const applyRoundingColors = (sheet, startRow, col, rowCount) => {
    if (rowCount <= 0) return;
    const range = sheet.getRange(startRow, col, rowCount, 1);
    const a1 = range.getA1Notation();
    const kept = sheet.getConditionalFormatRules()
      .filter((rule) => !rule.getRanges().some((r) => r.getA1Notation() === a1));
    sheet.setConditionalFormatRules(kept.concat(choiceColorRules(range, roundingChoices())));
  };

  /**
   * 今の列の表示・非表示を、見出しの名前をキーにして控えます。
   *
   * 隠す列を決め打ちにすると、確認のために表示した列が初期化のたびに閉じてしまいます。
   * シート上で右クリックして開いた・閉じたという操作をそのまま尊重するための控えです。
   * 列が増減してもずれないよう、列番号ではなく見出しの名前で持ちます。
   */
  const readHiddenState_ = (sheet) => {
    const state = {};
    const cols = sheet.getMaxColumns();
    if (cols < 1 || sheet.getLastRow() < 1) return state;
    const rows = Math.min(HEADER_ROWS, sheet.getMaxRows());
    const head = sheet.getRange(1, 1, rows, cols).getValues();
    for (let c = 1; c <= cols; c++) {
      // 1段見出しだった頃は1行目、2段になってからは2行目に列名が入る
      const name = String((head[rows - 1] && head[rows - 1][c - 1]) || head[0][c - 1] || '').trim();
      if (!name) continue;
      state[name] = sheet.isColumnHiddenByUser(c);
    }
    return state;
  };

  /**
   * 控えた表示状態を当て直します。控えに無い列（新しく増えた列）は既定に従います。
   */
  const applyHiddenState_ = (sheet, prevHidden) => {
    for (let c = 1; c <= TOTAL_COLS; c++) {
      const name = HEADERS[c - 1];
      const hide = Object.prototype.hasOwnProperty.call(prevHidden, name)
        ? prevHidden[name]
        : HIDDEN_COLS.indexOf(c) >= 0;
      if (hide) sheet.hideColumns(c);
      else sheet.showColumns(c);
    }
  };

  /**
   * サマリシート・設定シート・契約シートを整えます（初期化）。
   * データ行は消さず、ヘッダ・書式・固定行だけを作り直します。
   */
  const setup = (ss) => {
    const summary = ss.getSheetByName(SUMMARY_SHEET) || ss.insertSheet(SUMMARY_SHEET);

    // 今の表示・非表示を控えておく（初期化で勝手に戻さないため）
    const prevHidden = readHiddenState_(summary);

    // 固定行をまたぐ結合はできないので、組み立てる間だけ固定を外す。
    // 年月と日別の見出しは1行目と2行目を縦に結合するため、固定が1行のままだと境界を越えてしまう。
    summary.setFrozenRows(0);
    summary.setFrozenColumns(0);

    // 列数を合わせる（既定の26列では日別まで入らない）
    if (summary.getMaxColumns() < TOTAL_COLS) {
      summary.insertColumnsAfter(summary.getMaxColumns(), TOTAL_COLS - summary.getMaxColumns());
    } else if (summary.getMaxColumns() > TOTAL_COLS) {
      summary.deleteColumns(TOTAL_COLS + 1, summary.getMaxColumns() - TOTAL_COLS);
    }

    // ヘッダ。列構成が変わったときに前のメモや結合が残らないよう、先に解く
    const header = summary.getRange(1, 1, HEADER_ROWS, TOTAL_COLS);
    header.breakApart();
    header.clearNote();

    // 1段目にブロック名、2段目に列名。
    // 年月と日別はブロックを持たないので、列名を1段目に置いて縦に結合する。
    const row1 = new Array(TOTAL_COLS).fill('');
    const row2 = new Array(TOTAL_COLS).fill('');
    const groups = HEADER_GROUPS();
    groups.forEach((g) => {
      row1[g.from - 1] = g.label;
      for (let c = g.from; c <= g.to; c++) row2[c - 1] = HEADERS[c - 1];
    });
    row1[COL.YM - 1] = HEADERS[COL.YM - 1];
    row1[COL.CONTRACT - 1] = HEADERS[COL.CONTRACT - 1];
    for (let d = 0; d < MAX_DAYS; d++) row1[COL.DAY_START - 1 + d] = HEADERS[COL.DAY_START - 1 + d];

    header.setValues([row1, row2]);
    header.setFontWeight('bold').setHorizontalAlignment('center')
      .setVerticalAlignment('middle').setWrap(true);

    // 2段目（列名）は1色。ブロックの違いは1段目の言葉とアクセント罫で示す
    summary.getRange(1, 1, HEADER_ROWS, TOTAL_COLS)
      .setBackground(THEME.HEADER_AUTO).setFontColor(THEME.HEADER_TEXT).setFontSize(10);
    // 1段目（ブロック名）は一段濃く、字を小さく開いて見出しらしく
    summary.getRange(1, 1, 1, TOTAL_COLS)
      .setBackground(THEME.HEADER_GROUP).setFontColor(THEME.HEADER_GROUP_TEXT).setFontSize(9);

    // ブロック名は横に結合し、下にアクセント罫を敷く
    groups.forEach((g) => {
      const cell = summary.getRange(1, g.from, 1, g.to - g.from + 1);
      cell.merge();
      cell.setBorder(null, null, true, null, null, null, g.accent, SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
    });

    // 年月と日別は2段ぶんを縦に結合して、番号や見出しが常に見えるようにする
    // 年月と契約はどの月の行かを示すもので、ブロックには属さない
    const merged = [
      { col: COL.YM, accent: THEME.ACCENT_SUM, size: 10 },
      { col: COL.CONTRACT, accent: THEME.ACCENT_SUM, size: 10 },
    ];
    for (let d = 0; d < MAX_DAYS; d++) {
      merged.push({ col: COL.DAY_START + d, accent: THEME.ACCENT_DAY, size: DAY_FONT_SIZE });
    }
    merged.forEach((m) => {
      const cell = summary.getRange(1, m.col, HEADER_ROWS, 1);
      cell.merge();
      cell.setBackground(THEME.HEADER_AUTO).setFontColor(THEME.HEADER_TEXT).setFontSize(m.size);
      cell.setBorder(null, null, true, null, null, null, m.accent, SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
    });

    summary.setRowHeight(1, 24);
    summary.setRowHeight(2, 34);

    const note = (col, text) => summary.getRange(2, col).setNote(text);
    note(COL.CONTRACT, '契約シートの内容から自動で埋まります。直接編集しても更新で上書きされます。');
    note(COL.REVENUE, '月額単価＋精算額。発注元に請求される額。\n進行中の月は着地見込みの額。');
    note(COL.PAYMENT, '売上×還元率。支払われるはずの額。\n進行中の月は着地見込みの額。');
    note(COL.WORK_H, '精算の元になる時間。過去月は実績、進行中の月は着地見込み（斜体で表示）。');
    note(COL.OVERTIME, '実績時間 −（稼働日数 × 所定労働時間）。\n進行中の月は「今日までの残業」で、着地見込みではありません。');
    note(COL.DIFF_H, '精算幅からのはみ出し。稼働時間を元に計算する。');

    // 年月と見出しを固定して、右へスクロールしてもどの月か分かるようにする
    summary.setFrozenRows(HEADER_ROWS);
    summary.setFrozenColumns(1);

    // 列幅。同じ幅が続くところはまとめて指定して呼び出し回数を抑える
    let run = { from: 1, width: WIDTH[1] };
    for (let c = 2; c <= COL.DAY_START; c++) {
      const w = c === COL.DAY_START ? null : WIDTH[c];
      if (w === run.width) continue;
      summary.setColumnWidths(run.from, c - run.from, run.width);
      run = { from: c, width: w };
    }
    summary.setColumnWidths(COL.DAY_START, MAX_DAYS, DAY_WIDTH);
    applyHiddenState_(summary, prevHidden);
    summary.setHiddenGridlines(true);

    // サマリは全ての列が勤務表と契約から自動で作られるため、シートごと保護する
    protectRanges(summary, [], PROTECT_SUMMARY);

    Config.setup(ss);
    Contracts.setup(ss);
    return summary;
  };

  /**
   * 範囲を保護します（うっかり上書きを防ぐ）。
   *
   * このファイルの所有者は自分自身なので、編集者から外して完全に禁止することはできません。
   * 代わりに警告のみの保護にして、編集しようとしたときに確認が出るようにします。
   * 警告はUIの操作にだけ出るため、スクリプトからの書き込みは止まりません。
   *
   * 同じ説明の保護を先に外してから付け直すので、初期化を繰り返しても増えません。
   *
   * @param sheet 対象シート
   * @param ranges 保護する範囲の配列。空ならシート全体
   * @param description 保護の説明（付け直しの目印にもなる）
   */
  const protectRanges = (sheet, ranges, description) => {
    [SpreadsheetApp.ProtectionType.RANGE, SpreadsheetApp.ProtectionType.SHEET].forEach((type) => {
      sheet.getProtections(type).forEach((p) => {
        if (p.getDescription() === description) p.remove();
      });
    });
    const targets = ranges && ranges.length ? ranges.map((r) => r.protect()) : [sheet.protect()];
    targets.forEach((p) => p.setDescription(description).setWarningOnly(true));
  };

  /**
   * 使っていない行と列を削除します。
   * 既定の1000行×26列が残っていると、どこまでが表なのか分からず操作しづらいためです。
   * @param sheet 対象シート
   * @param rows 残す行数（見出しを含む）
   * @param cols 残す列数
   */
  const trim = (sheet, rows, cols) => {
    const keepRows = Math.max(rows, 1);
    const keepCols = Math.max(cols, 1);
    if (sheet.getMaxRows() > keepRows) sheet.deleteRows(keepRows + 1, sheet.getMaxRows() - keepRows);
    if (sheet.getMaxColumns() > keepCols) sheet.deleteColumns(keepCols + 1, sheet.getMaxColumns() - keepCols);
  };

  return {
    SUMMARY_SHEET, CONFIG_SHEET, DATA_START_ROW, MAX_DAYS, TOTAL_COLS,
    COL, CONTRACT_COLS, WIDTH, DAY_WIDTH, BG, THEME, HEADERS, PROTECT_SUMMARY, PROTECT_HEADER,
    DAY_FONT_SIZE, ROW_HEIGHT, HIDDEN_COLS, NAMED_STD_HOURS, OVERTIME_ALERT, HEADER_ROWS,
    colLetter, roundedByCell, formulasFor, yearRowFor, styleYearRows, styleForecastCells, groupRows,
    applyFormats, applyRoundingColors, applyOvertimeAlert, choiceColorRules, roundingChoices,
    protectRanges, trim, setup,
  };
})();
