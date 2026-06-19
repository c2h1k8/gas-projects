/**
 * 勤怠連絡漏れ・勤怠未登録の監視（時間主導トリガーのエントリーポイント）。
 * 判定ロジック本体は MainProc.checkContactOmissions に委譲する。
 */

/**
 * 12時トリガー: 開始登録のみで未登録を判定。
 */
function checkAttendanceNoon() {
  MainProc.checkContactOmissions('noon');
}

/**
 * 23時トリガー: 開始・終了の両方で未登録を判定。
 */
function checkAttendanceNight() {
  MainProc.checkContactOmissions('night');
}

/**
 * 監視トリガーを登録します（手動実行）。
 * 既存の同名トリガーを削除してから 12時 / 23時 の日次トリガーを作成する。
 */
function setupAttendanceTriggers() {
  const handlers = ['checkAttendanceNoon', 'checkAttendanceNight'];
  ScriptApp.getProjectTriggers().forEach((t) => {
    if (handlers.includes(t.getHandlerFunction())) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('checkAttendanceNoon').timeBased().atHour(12).everyDays(1).create();
  ScriptApp.newTrigger('checkAttendanceNight').timeBased().atHour(23).everyDays(1).create();
  Logger.log('勤怠監視トリガーを登録しました（12時 / 23時）');
}
