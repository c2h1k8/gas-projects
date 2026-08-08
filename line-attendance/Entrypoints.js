/**
 * GASエントリーポイント集約。
 * Web（doPost）と時間主導トリガーから呼ばれるグローバル関数をここに集める。
 * 判定・通知ロジック本体はすべて MainProc に委譲する。
 */

/**
 * Lineメッセージ受信ハンドラ（Webアプリのエントリーポイント）。
 */
function doPost(e) {
  // 受信データ取得
  const eventData = JSON.parse(e.postData.contents).events[0];
  const replyToken = eventData.replyToken;
  switch (eventData.type) {
    case 'postback':
      MainProc.handlePostback(replyToken, eventData.postback);
      return;
    case 'message':
      MainProc.handleMessage(replyToken, eventData.message);
      break;
  }
}

/**
 * 12時トリガー: 開始登録のみで未登録を判定。
 */
function checkAttendanceNoon() {
  MainProc.checkAttendanceOmissions('noon');
}

/**
 * 23時トリガー: 開始・終了の両方で未登録を判定。
 */
function checkAttendanceNight() {
  MainProc.checkAttendanceOmissions('night');
}

/**
 * 月中サマリートリガー（毎月15日9時想定）。当月累計・残業・着地見込みを通知。
 */
function summaryMidMonth() {
  MainProc.notifyMidMonthSummary();
}

/**
 * 前月確定サマリートリガー（毎月1日9時想定）。確定した前月の総稼働・残業を通知。
 */
function summaryPrevMonth() {
  MainProc.notifyPrevMonthSummary();
}

/**
 * 有休台帳を勤務表と予約から作り直します（手動実行）。
 * 勤務表を直接直して有給の日を変えたときに実行する。
 */
function rebuildPaidLeaveLedger() {
  const ledger = MainProc.rebuildPaidLeaveLedger();
  Logger.log(`有休台帳を作り直しました: 付与${ledger.grants.length}件 / 消化${Object.keys(ledger.used).length}日`);
}
