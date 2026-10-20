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

  /**
   * 前回の更新で勤務表の読み取りに使った設定（JSON）。
   * 設定が変わっていたら、過去の月も含めて全て読み直すための控えです。
   */
  LAST_READ_CONFIG: 'LAST_READ_CONFIG',
};
