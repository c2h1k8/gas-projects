/**
 * シート名・列番号・設定項目など、レイアウトの定義。
 *
 * 他のモジュールはここの名前だけを使い、列や行の番号を直接書かないようにしています。
 * 列の並びを変えるときは、このファイルだけを直します
 * （入力単位・案件の選び方・刻み・所定労働時間・案件枠の数・報告シートへの反映は設定シートで変える）。
 */
const Layout = (function () {
  /** サマリシート名（先頭に置き、続けて月シートを新しい順に並べる） */
  const SUMMARY_SHEET = 'サマリ';
  /** 案件マスタのシート名（月シートの後ろに置く） */
  const MASTER_SHEET = '案件マスタ';
  /** 設定シート名（案件マスタの後ろに置く） */
  const SETTINGS_SHEET = '設定';
  /** 月シート名の書式（'2026-10'） */
  const MONTH_SHEET_FORMAT = 'yyyy-MM';
  /** 月シート名かどうかの判定 */
  const MONTH_SHEET_PATTERN = /^\d{4}-\d{2}$/;
  /** 祝日を曜日欄に付ける印（'月(祝)'）。見込みの営業日判定もこの文字で見る */
  const HOLIDAY_MARK = '(祝)';

  /** 選択肢の「コード：案件名」の区切り */
  const LABEL_SEPARATOR = '：';

  /** 1日の上限（時間）。工数1枠・日合計ともにこれを超えたら入力ミス扱い */
  const DAY_HOURS_MAX = 24;
  /**
   * 合計の表示書式。合計はすべて時:分（勤怠連絡の 8:30 などと見比べるため）で、
   * 値は日の割合（8:30 ＝ 8.5/24）で持つ。24時間を超えても繰り上げない。
   */
  const HM_FORMAT = '[h]:mm';

  /** 工数の入力単位。月シートの作成時に設定シートから決め、そのシートでは固定（入力規則が単位で変わるため） */
  const UNIT = {
    HOURS: '時間',  // 1時間半 → 1.5
    MINUTES: '分',  // 1時間半 → 90
  };
  /** 入力単位ごとの工数の表示書式（0 は空欄） */
  const INPUT_FORMAT = { [UNIT.HOURS]: '0.0#;-0.0#;', [UNIT.MINUTES]: '0;-0;' };
  /** 報告シートへ書く工数の単位 */
  const REPORT_UNIT = {
    HOURS: '時間',    // 1.5
    MINUTES: '分',    // 90
    HM: '時:分',      // 1:30
  };

  /** 日の入力で案件をどう選ぶか（プルダウンに出す値）。月シートの作成時に設定シートから決める */
  const PICK = {
    LABEL: 'コード：案件名',
    CODE: '案件コード',
    NAME: '案件名',
    SHORT: '略称',
  };

  /** 月シートに残す作成時の設定（開発者メタデータのキー）。報告シートへの反映で値の意味を知るために使う */
  const META = { UNIT: 'project-hours.unit', PICK: 'project-hours.pick', SLOTS: 'project-hours.slots' };

  /** 1日の案件枠の数の上限（設定シートの入力規則） */
  const SLOTS_MAX = 10;

  /**
   * 設定シートの項目（値は VALUE_COL 列）。section は見出しの行、各項目は値の行。
   * 所定労働時間は見込みの数式が行の位置で参照するので、並びを変えたら作成済みの月シートも作り直す。
   */
  const SETTINGS = {
    VALUE_COL: 2,
    SECTIONS: [
      { row: 3, title: '入力' },
      { row: 10, title: '報告シートへの反映' },
    ],
    UNIT: { row: 4, label: '入力単位', value: UNIT.HOURS, list: Object.values(UNIT),
      note: '工数を「時間」（1時間半なら 1.5）と「分」（90）のどちらで入力するか。合計はどちらでも 13:30 の形で出る。次に作る月シートから反映' },
    PICK: { row: 5, label: '案件の選び方', value: PICK.LABEL, list: Object.values(PICK),
      note: '日の入力のプルダウンに出す値。「略称」にすると略称が空の案件はプルダウンに出ない。次に作る月シートから反映' },
    STEP_MIN: { row: 6, label: '入力の刻み（分）', value: 15,
      note: '工数をこの分単位でしか入力できないようにする（時間で入力するときは 15分＝0.25）。次に作る月シートから反映' },
    STD_HOURS: { row: 7, label: '所定労働時間', value: 8 / 24, // 時:分の値は日の割合（8:00 ＝ 8/24）
      note: '見込みの計算に使う（今日以降でまだ入力していない営業日を、この時間で埋めて足す）。すべての月にすぐ反映' },
    SLOTS: { row: 8, label: '1日の案件枠の数', value: 5,
      note: `1日に入力できる案件の数（1〜${SLOTS_MAX}）。月シートの案件別集計もこの数で折り返す。次に作る月シートから反映` },

    REPORT_SHEET: { row: 11, label: 'シート名', value: '',
      note: '報告ファイルの中で書き込むシートの名前。報告ファイルはサマリの「報告シート」列に月ごとにリンクを貼る' },
    REPORT_START_ROW: { row: 12, label: '入力開始行', value: 2,
      note: '1件目を書き込む行。ここから下へ、日付順に1日×1案件で1行ずつ書く' },
    REPORT_DATE_COL: { row: 13, label: '日付の列', value: 'A', note: '日付を書く列（A, B, …）' },
    REPORT_CODE_COL: { row: 14, label: '案件コードの列', value: 'B', note: '案件コードを書く列。空欄なら書かない' },
    REPORT_NAME_COL: { row: 15, label: '案件名の列', value: 'C', note: '案件名を書く列。空欄なら書かない' },
    REPORT_HOURS_COL: { row: 16, label: '工数の列', value: 'D', note: '工数を書く列' },
    REPORT_UNIT: { row: 17, label: '工数の単位', value: REPORT_UNIT.HOURS, list: Object.values(REPORT_UNIT),
      note: '報告シートに書く工数の単位（1時間半なら 時間＝1.5、分＝90、時:分＝1:30）' },
    REPORT_HOUR: { row: 18, label: '反映時刻（時）', value: 22,
      note: '毎日この時台に当月分を反映する（月初の数日は前月分も）。変えたらメニューの「トリガーを設定」をやり直す' },
    REPORT_PREV_DAYS: { row: 19, label: '前月分も反映する日数', value: 5,
      note: '月初のこの日数までは、毎日の反映で前月分も書き直す（月末の入力が翌月にずれ込んでも反映されるように）。0 なら前月分は書かない' },
  };

  /** 案件マスタの列 */
  const MASTER = {
    CODE: 1,     // 案件コード（英数字・ハイフン・アンダースコア）
    NAME: 2,     // 案件名
    SHORT: 3,    // 略称（任意）。集計欄・サマリの見出しは略称があれば略称で出す
    REPORT: 4,   // 報告対象（チェックした案件だけ報告シートへ書く）
    ORDER: 5,    // 表示順（任意。サマリの列・案件別集計の並び。空欄は数字の後ろにマスタの順で並ぶ）
    LABEL: 6,    // 選択肢（数式で「コード：案件名」を作る）
    NOTE: 7,     // 備考
    // プルダウン用の一覧（非表示）。案件の選び方ごとに、その列の値を表示順に並べ直したもの。日の入力の入力規則が参照する
    PICK_LISTS: { [PICK.LABEL]: 8, [PICK.CODE]: 9, [PICK.NAME]: 10, [PICK.SHORT]: 11 },
    HEADERS: ['案件コード', '案件名', '略称', '報告対象', '表示順', '選択肢（自動）', '備考',
      '一覧：コード：案件名', '一覧：案件コード', '一覧：案件名', '一覧：略称'],
    HEADER_ROW: 3,
    FIRST_ROW: 4,
    ROWS: 200,   // 用意しておく行数（足りなければ行を追加すれば入力規則も広がる）
  };

  /**
   * 月シートの行と列。
   * 1〜4行目は固定表示の集計欄で、左に月合計・見込み・稼働日数、右に案件別集計を置く。
   * 5行目が見出しで、6行目から1日1行。
   * 日合計は日付の隣に置いて列ごと固定し、案件枠を横にスクロールしても見えるようにしています。
   */
  const MONTH = {
    TITLE_ROW: 1,
    TOTAL_ROW: 2,       // 月合計
    FORECAST_ROW: 3,    // 見込み
    WORK_DAYS_ROW: 4,   // 稼働日数
    HEADER_ROW: 5,
    FIRST_DAY_ROW: 6,
    LABEL_COL: 1,       // 2〜4行目の項目名（日付・曜日の2列を結合）

    DATE: 1,
    DOW: 2,             // 曜日（祝日は「月(祝)」）
    DAY_TOTAL: 3,       // 日合計（時:分）。2〜4行目は月合計・見込み・稼働日数
    FIRST_SLOT: 4,                          // 案件1の列。以降「案件・工数」の2列ずつ並ぶ
    // 備考（最終列）は案件枠の数で位置が変わるので noteCol で求める

    // 案件別集計。案件枠の列に合わせ、1案件を「案件列＝コード：略称、工数列＝時:分」の2列で横に並べる。
    // 1行に案件枠の数だけ並べ、超えたら次の行へ折り返す（AGG_ROWS 行 × 案件枠の数 件まで）
    AGG_TITLE_ROW: 2,
    AGG_FIRST_ROW: 3,
    AGG_ROWS: 2,
    AGG_FIRST_COL: 4,
  };

  /** 案件枠 i（0始まり）の案件列 */
  const slotCodeCol = (i) => MONTH.FIRST_SLOT + i * 2;
  /** 案件枠 i（0始まり）の工数列 */
  const slotHoursCol = (i) => MONTH.FIRST_SLOT + i * 2 + 1;
  /** 案件枠が slots 個の月シートの備考列（最終列） */
  const noteCol = (slots) => MONTH.FIRST_SLOT + slots * 2;

  /** サマリの行と列 */
  const SUMMARY = {
    TITLE_ROW: 1,
    HEADER_ROW: 3,
    FIRST_ROW: 4,
    YM: 1,
    WORK_DAYS: 2,
    TOTAL: 3,          // 合計工数
    FORECAST: 4,       // 見込み
    REPORT_LINK: 5,    // 報告シート（手入力。月ごとの報告ファイルのリンクを貼る）
    REPORTED_AT: 6,    // 最終反映（報告シートへの反映結果）
    FIRST_PROJECT: 7,  // 以降、案件マスタの順に1案件1列
  };

  /** A1 形式の列名 */
  const colA1 = (col) => {
    let s = '';
    for (let n = col; n > 0; n = Math.floor((n - 1) / 26)) {
      s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
    }
    return s;
  };

  /** A1 形式の列名を列番号にします（'A' → 1）。不正なら null */
  const colNo = (letters) => {
    const s = String(letters || '').trim().toUpperCase();
    if (!/^[A-Z]{1,3}$/.test(s)) return null;
    return [...s].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
  };

  /** 数式で使うシート名（'2026-10'! のように引用符で囲む） */
  const sheetRef = (name) => `'${name.replace(/'/g, "''")}'!`;

  return {
    SUMMARY_SHEET, MASTER_SHEET, SETTINGS_SHEET, MONTH_SHEET_FORMAT, MONTH_SHEET_PATTERN, HOLIDAY_MARK,
    LABEL_SEPARATOR, DAY_HOURS_MAX, HM_FORMAT, UNIT, INPUT_FORMAT, REPORT_UNIT, PICK, META,
    SLOTS_MAX, SETTINGS, MASTER, MONTH, SUMMARY,
    slotCodeCol, slotHoursCol, noteCol, colA1, colNo, sheetRef,
  };
})();
