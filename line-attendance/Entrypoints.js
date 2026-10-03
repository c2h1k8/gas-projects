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
