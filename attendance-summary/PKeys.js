const PKeys = {
  /**
   * 勤務表ファイルの索引（JSON）。
   * { months: { 'yyyyMM': { id, created } }, ignored: [fileId], scannedAt: 'yyyy-MM-dd' }
   *
   * 年月とファイルIDの対応をここに残すことで、毎回フォルダを走査せずに済ませます。
   */
  FILE_INDEX: 'FILE_INDEX',

  /**
   * 設定シートの値の控え（JSON: { 項目名: 値 }）。
   * シートを作り直しても、入力済みの値を打ち直さずに済むように残します。
   */
  CONFIG_BACKUP: 'CONFIG_BACKUP',
};
