/**
 * 出力した直近のログを取得します。
 * @param needsClear ログクリア可否
 * @return 出力ログ
 */
function getLog(needsClear = true) {
  const logArray = getLogs(needsClear);
  if (logArray.length) {
    return logArray[0];
  }
  return '';
}

/**
 * 出力した全ログを取得します。
 * @param needsClear ログクリア可否
 * @return 出力ログ配列
 */
function getLogs(needsClear = true) {
  const log = " " + Logger.getLog().trim();
  if (needsClear) {
    Logger.clear();
  }
  const logArray = log.split(/\s[A-Z]{1}[a-z]{2} [A-Z]{1}[a-z]{2} [\d]{1,2} [\d]{2}:[\d]{2}:[\d]{2} JST [\d]{4} INFO: /g);  
  logArray.shift();
  return logArray.reverse();
}

/**
 * 最終行を取得します。
 * @param sheet シート
 * @param targetCol 対象列
 * @return 行番号
 */
function getEndRow(sheet, targetCol) {
  return sheet.getRange(sheet.getMaxRows(), targetCol).getNextDataCell(SpreadsheetApp.Direction.UP).getRowIndex();
}

/**
 * 最終列を取得します。
 * @param sheet シート
 * @param targetRow 対象行
 * @return 列番号
 */
function getEndCol(sheet, targetRow) {
  return sheet.getRange(targetRow, sheet.getMaxColumns()).getNextDataCell(SpreadsheetApp.Direction.PREVIOUS).getColumnIndex();
}

/**
 * リスト用入力規則ビルダを取得します。
 * https://developers.google.com/apps-script/reference/spreadsheet/data-validation-builder#requireValueInList(String)
 * @param list リスト
 * @param isAllowInvalid 入力エラー拒否可否
 * @return 入力規則ビルダ
 */
function getDataValidationList(list, isAllowInvalid) {
  if (!isAllowInvalid) isAllowInvalid = false;
  return SpreadsheetApp.newDataValidation().requireValueInList(list).setAllowInvalid(isAllowInvalid).build();
}

/**
 * 名前定義用入力規則ビルダを取得します。
 * https://developers.google.com/apps-script/reference/spreadsheet/data-validation-builder#requirevalueinrangerange
 * @param name 名前定義
 * @param isAllowInvalid 入力エラー拒否可否
 * @return 入力規則ビルダ
 */
function getDataValidationRangeName(name, isAllowInvalid) {
  const rng = SpreadsheetApp.getActiveSpreadsheet().getRangeByName(name);
  if (!isAllowInvalid) isAllowInvalid = false;
  return SpreadsheetApp.newDataValidation().requireValueInRange(rng).setAllowInvalid(isAllowInvalid).build();
}

/**
 * カレンダー用入力規則ビルダを取得します。
 * https://developers.google.com/apps-script/reference/spreadsheet/data-validation-builder#requiredate
 * @param isAllowInvalid 入力エラー拒否可否
 * @return 入力規則ビルダ
 */
function getDataValidationDate(isAllowInvalid) {
  if (!isAllowInvalid) isAllowInvalid = false;
  return SpreadsheetApp.newDataValidation().requireDate().setAllowInvalid(isAllowInvalid).build();
}

/**
 * HTMLから指定した開始文字と終了文字の間の文字列配列を取得します。
 * @param html HTMLテキスト
 * @param from 開始文字
 * @param to 終了文字
 * @return 抽出文字列配列
 */
function getHtmlElements(html, from, to) {
  return Parser.data(html).from(from).to(to).iterate();
}
/**
 * HTMLから指定した開始文字と終了文字の間の文字列を取得します。
 * @param html HTMLテキスト
 * @param from 開始文字
 * @param to 終了文字
 * @return 抽出文字列
 */
function getHtmlElement(html, from, to) {
  return Parser.data(html).from(from).to(to).build();
}