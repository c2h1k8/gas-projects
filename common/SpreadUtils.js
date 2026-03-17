const SpreadUtils = (function () {
  return {
    /**
     * 最終行を取得します。
     * @param {Sheet} sheet シート
     * @param {number} targetCol 対象列
     * @returns {number} 行番号
     */
    getEndRow: (sheet, targetCol) => {
      return sheet.getRange(sheet.getMaxRows(), targetCol).getNextDataCell(SpreadsheetApp.Direction.UP).getRowIndex();
    },

    /**
     * 最終列を取得します。
     * @param {Sheet} sheet シート
     * @param {number} targetRow 対象行
     * @returns {number} 列番号
     */
    getEndCol: (sheet, targetRow) => {
      return sheet.getRange(targetRow, sheet.getMaxColumns()).getNextDataCell(SpreadsheetApp.Direction.PREVIOUS).getColumnIndex();
    },

    /**
     * リスト用入力規則を取得します。
     * @param {string[]} list リスト
     * @param {boolean} [isAllowInvalid=false] 入力エラー拒否可否
     * @returns {DataValidation}
     */
    getDataValidationList: (list, isAllowInvalid = false) => {
      return SpreadsheetApp.newDataValidation().requireValueInList(list).setAllowInvalid(isAllowInvalid).build();
    },

    /**
     * 名前定義用入力規則を取得します。
     * @param {string} name 名前定義
     * @param {boolean} [isAllowInvalid=false] 入力エラー拒否可否
     * @returns {DataValidation}
     */
    getDataValidationRangeName: (name, isAllowInvalid = false) => {
      const rng = SpreadsheetApp.getActiveSpreadsheet().getRangeByName(name);
      return SpreadsheetApp.newDataValidation().requireValueInRange(rng).setAllowInvalid(isAllowInvalid).build();
    },

    /**
     * カレンダー用入力規則を取得します。
     * @param {boolean} [isAllowInvalid=false] 入力エラー拒否可否
     * @returns {DataValidation}
     */
    getDataValidationDate: (isAllowInvalid = false) => {
      return SpreadsheetApp.newDataValidation().requireDate().setAllowInvalid(isAllowInvalid).build();
    },

    /**
     * 出力した直近のログを取得します。
     * @param {boolean} [needsClear=true] ログクリア可否
     * @returns {string} 出力ログ
     */
    getLog: (needsClear = true) => {
      const logArray = SpreadUtils.getLogs(needsClear);
      return logArray.length ? logArray[0] : '';
    },

    /**
     * 出力した全ログを取得します。
     * @param {boolean} [needsClear=true] ログクリア可否
     * @returns {string[]} 出力ログ配列
     */
    getLogs: (needsClear = true) => {
      const log = ' ' + Logger.getLog().trim();
      if (needsClear) Logger.clear();
      const logArray = log.split(/\s[A-Z]{1}[a-z]{2} [A-Z]{1}[a-z]{2} [\d]{1,2} [\d]{2}:[\d]{2}:[\d]{2} JST [\d]{4} INFO: /g);
      logArray.shift();
      return logArray.reverse();
    },
  };
})();
