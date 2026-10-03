/**
 * 全シートで共通の見た目（配色・フォント・見出し・行の高さ）。
 *
 * 枠線は横線だけにし、目盛線は消して、色は見出し・合計・曜日・警告に絞っています。
 * 配色を変えるときはこのファイルの COLOR だけを直します。
 */
const Style = (function () {
  const FONT = 'Noto Sans JP';

  const COLOR = {
    INK: '#1f2937',          // 本文
    MUTED: '#6b7280',        // 補足・説明
    LINE: '#e5e7eb',         // 行の区切り線
    ACCENT: '#4f46e5',       // タイトル・強調
    HEADER_BG: '#1f2937',
    HEADER_FG: '#ffffff',
    SECTION_BG: '#eef2ff',   // 設定の区切り見出し
    TOTAL_BG: '#eef2ff',     // 合計
    TOTAL_FG: '#3730a3',
    YEAR_BG: '#c7d2fe',      // サマリの年の見出し行（小計）
    YEAR_FG: '#312e81',
    GRAND_BG: '#312e81',     // サマリの合計行
    GRAND_FG: '#ffffff',
    AUTO_BG: '#f9fafb',      // 数式で自動生成する欄
    SAT_BG: '#eff6ff',
    SAT_FG: '#1d4ed8',
    HOLIDAY_BG: '#fef2f2',   // 日曜・祝日
    HOLIDAY_FG: '#b91c1c',
    TODAY_BG: '#fde68a',     // 今日の行
    TODAY_MARK_BG: '#4f46e5', // 今日の日付・曜日（白抜き）
    TODAY_MARK_FG: '#ffffff',
    ERROR_BG: '#fecaca',     // 案件と工数の片方だけ、日合計が24時間超
    TAB_SUMMARY: '#4f46e5',
    TAB_MONTH: '#a5b4fc',
    TAB_SETTING: '#9ca3af',
  };

  /** シート全体の下地（フォント・文字色・目盛線なし・縦位置中央）。 */
  const base = (sheet, tabColor) => {
    sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns())
      .setFontFamily(FONT).setFontSize(10).setFontColor(COLOR.INK).setVerticalAlignment('middle');
    sheet.setHiddenGridlines(true);
    if (tabColor) sheet.setTabColor(tabColor);
  };

  /**
   * 1行目のタイトル。A1 から span 列を結合して置く
   * （隣の空きセルへのはみ出しに頼ると、1列目が狭いシートで文字が切れるため）。
   * 固定表示の列と固定していない列はまたいで結合できないので、span は固定する列の中に収めること。
   */
  const title = (sheet, text, span = 1) => {
    sheet.setRowHeight(1, 40);
    const range = sheet.getRange(1, 1, 1, span);
    if (span > 1) range.merge();
    range.setValue(text).setFontSize(16).setFontWeight('bold').setFontColor(COLOR.INK).setWrap(false);
  };

  /** 見出し行。 */
  const header = (range) => {
    range.setBackground(COLOR.HEADER_BG).setFontColor(COLOR.HEADER_FG).setFontWeight('bold')
      .setFontSize(9).setHorizontalAlignment('center').setWrap(true);
    range.getSheet().setRowHeight(range.getRow(), 30);
  };

  /** 表の本体に横線だけを引きます。 */
  const rowLines = (range) => {
    range.setBorder(null, null, true, null, null, true, COLOR.LINE, SpreadsheetApp.BorderStyle.SOLID);
  };

  /** シートの行数・列数を合わせます（使わない行・列は消す）。 */
  const fitSize = (sheet, rows, cols) => {
    const maxRows = sheet.getMaxRows();
    if (maxRows > rows) sheet.deleteRows(rows + 1, maxRows - rows);
    else if (maxRows < rows) sheet.insertRowsAfter(maxRows, rows - maxRows);
    const maxCols = sheet.getMaxColumns();
    if (maxCols > cols) sheet.deleteColumns(cols + 1, maxCols - cols);
    else if (maxCols < cols) sheet.insertColumnsAfter(maxCols, cols - maxCols);
  };

  return { FONT, COLOR, base, title, header, rowLines, fitSize };
})();
