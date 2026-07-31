/**
 * テストランナー
 *
 * GASエディタのメニュー「実行」から各 test_* 関数を直接実行できます。
 * 実行結果は「実行ログ」に出力されます。
 *
 * スプレッドシートへの読み書きはスキップされ、モックデータで動作します。
 * LINEへの返信はreplyTokenが空のためpostに切り替わります（LINE API設定が必要）。
 */

// --- ヘルパー ---

function _setupTest_() {
  MainProc.enableTestMode();
  Logger.log('========== テスト開始 ==========');
}

function _teardownTest_() {
  MainProc.disableTestMode();
  Logger.log('========== テスト終了 ==========\n');
}

/** LINEメッセージを模擬して handleMessage を呼び出す */
function _runMessage_(text) {
  Logger.log(`[MSG] "${text}"`);
  MainProc.handleMessage('', { type: 'text', text: text });
}

/** LINEポストバックを模擬して handlePostback を呼び出す */
function _runPostback_(data, params) {
  Logger.log(`[PB]  data=${JSON.stringify(data)}${params ? ' params=' + JSON.stringify(params) : ''}`);
  MainProc.handlePostback('', { data: JSON.stringify(data), params: params });
}

// --- 個別テスト関数（GASエディタから選択実行可能） ---

/** テスト: 退社時刻のみ (例: "1930") */
function test_message_退社時刻のみ() {
  _setupTest_();
  _runMessage_('1930');
  _teardownTest_();
}

/** テスト: 出社・退社時刻 (例: "0900 1930") */
function test_message_出社退社() {
  _setupTest_();
  _runMessage_('0900 1930');
  _teardownTest_();
}

/** テスト: 日付指定付き出退社 (例: "1th 0900 1930") */
function test_message_日付指定出退社() {
  _setupTest_();
  _runMessage_('1th 0900 1930');
  _teardownTest_();
}

/** テスト: 有給休暇 */
function test_message_有給() {
  _setupTest_();
  _runMessage_('h');
  _teardownTest_();
}

/** テスト: 欠勤 */
function test_message_欠勤() {
  _setupTest_();
  _runMessage_('r');
  _teardownTest_();
}

/** テスト: 代休 */
function test_message_代休() {
  _setupTest_();
  _runMessage_('d');
  _teardownTest_();
}

/** テスト: 休日出勤 + 退社時刻 */
function test_message_休日出勤() {
  _setupTest_();
  _runMessage_('w 1930');
  _teardownTest_();
}

/** テスト: クリア */
function test_message_クリア() {
  _setupTest_();
  _runMessage_('c');
  _teardownTest_();
}

/** テスト: 勤怠一覧（当月） */
function test_message_リスト() {
  _setupTest_();
  _runMessage_('リスト');
  _teardownTest_();
}

/** テスト: 勤怠一覧（先月） */
function test_message_リスト先月() {
  _setupTest_();
  _runMessage_('リスト1');
  _teardownTest_();
}

/** テスト: 出勤ポストバック */
function test_postback_出勤() {
  _setupTest_();
  _runPostback_({ action: 'start' });
  _teardownTest_();
}

/** テスト: 退勤ポストバック */
function test_postback_退勤() {
  _setupTest_();
  _runPostback_({ action: 'end' });
  _teardownTest_();
}

/** テスト: 欠勤ポストバック */
function test_postback_欠勤() {
  _setupTest_();
  _runPostback_({ action: 'break' });
  _teardownTest_();
}

/** テスト: 稼働一覧ポストバック */
function test_postback_一覧() {
  _setupTest_();
  _runPostback_({ action: 'list', month: '' });
  _teardownTest_();
}

/** テスト: 過去12ヶ月の推移ポストバック（バー／前月比／休暇バッジ／所定比／注意月／年間集計） */
function test_postback_推移() {
  _setupTest_();
  _runPostback_({ action: 'history' });
  _teardownTest_();
}

/** テスト: ヘルプポストバック */
function test_postback_ヘルプ() {
  _setupTest_();
  _runPostback_({ action: 'help' });
  _teardownTest_();
}

/** テスト: カレンダー登録ポストバック（出勤・日付選択後 → 1日カード） */
function test_postback_カレンダー() {
  _setupTest_();
  _runPostback_({ action: 'calendar', type: '出勤' }, { date: '2026-07-22' });
  _teardownTest_();
}

/** テスト: カレンダー登録ポストバック（欠勤・日付選択後） */
function test_postback_カレンダー欠勤() {
  _setupTest_();
  _runPostback_({ action: 'calendar', type: '欠勤' }, { date: '2026-07-22' });
  _teardownTest_();
}

/** テスト: 1日カードから退社時刻を登録（同じ1日カードへ戻る） */
function test_postback_1日カード_退社入力() {
  _setupTest_();
  _runPostback_({ action: 'fill-punch', date: '2026-07-22', field: 'end', single: 1 }, { time: '19:30' });
  _teardownTest_();
}

/** テスト: 未登録一覧 */
function test_postback_未登録一覧() {
  _setupTest_();
  _runPostback_({ action: 'unregistered' });
  _teardownTest_();
}

/** テスト: 未登録一覧から退社時刻を登録（出社は現状維持） */
function test_postback_未登録_退社入力() {
  _setupTest_();
  _runPostback_({ action: 'fill-punch', date: '2026-07-22', field: 'end' }, { time: '19:30' });
  _teardownTest_();
}

/** テスト: 未登録一覧から出社時刻を登録（退社は現状維持） */
function test_postback_未登録_出社入力() {
  _setupTest_();
  _runPostback_({ action: 'fill-punch', date: '2026-07-22', field: 'start' }, { time: '10:00' });
  _teardownTest_();
}

/** テスト: 今週の状況（週の途中でも当日までで集計） */
function test_postback_今週の状況() {
  _setupTest_();
  _runPostback_({ action: 'weekly' });
  _teardownTest_();
}

/** テスト: 提出状況 */
function test_postback_提出状況() {
  _setupTest_();
  _runPostback_({ action: 'submit-status' });
  _teardownTest_();
}

/** テスト: 着地見込み */
function test_postback_着地見込み() {
  _setupTest_();
  _runPostback_({ action: 'forecast' });
  _teardownTest_();
}

/** テスト: 勤務表を開く */
function test_postback_勤務表を開く() {
  _setupTest_();
  _runPostback_({ action: 'workbook' });
  _teardownTest_();
}

/** テスト: 翌月勤務表の作成 */
function test_postback_翌月作成() {
  _setupTest_();
  _runPostback_({ action: 'make-schedule' });
  _teardownTest_();
}

/** テスト: 勤怠監視（12時・開始登録のみで判定） */
function test_監視_12時() {
  _setupTest_();
  MainProc.checkAttendanceOmissions('noon');
  _teardownTest_();
}

/** テスト: 勤怠監視（23時・開始終了の両方で判定） */
function test_監視_23時() {
  _setupTest_();
  MainProc.checkAttendanceOmissions('night');
  _teardownTest_();
}

/** テスト: 週次サマリー通知 */
function test_サマリー_週次() {
  _setupTest_();
  MainProc.notifyWeeklySummary();
  _teardownTest_();
}

/** テスト: 月中サマリー通知 */
function test_サマリー_月中() {
  _setupTest_();
  MainProc.notifyMidMonthSummary();
  _teardownTest_();
}

/** テスト: 前月確定サマリー通知 */
function test_サマリー_前月確定() {
  _setupTest_();
  MainProc.notifyPrevMonthSummary();
  _teardownTest_();
}

/** すべてのメッセージ/ポストバックテストを一括実行 */
function test_all() {
  MainProc.enableTestMode();
  Logger.log('========== 全テスト開始 ==========');

  const suite = [
    ['MSG 退社時刻のみ',       () => _runMessage_('1930')],
    ['MSG 出社退社',           () => _runMessage_('0900 1930')],
    ['MSG 日付指定出退社',     () => _runMessage_('1th 0900 1930')],
    ['MSG 有給',               () => _runMessage_('h')],
    ['MSG 欠勤',               () => _runMessage_('r')],
    ['MSG 代休',               () => _runMessage_('d')],
    ['MSG 休日出勤',           () => _runMessage_('w 1930')],
    ['MSG クリア',             () => _runMessage_('c')],
    ['MSG リスト当月',         () => _runMessage_('リスト')],
    ['MSG リスト先月',         () => _runMessage_('リスト1')],
    ['PB 出勤',                () => _runPostback_({ action: 'start' })],
    ['PB 退勤',                () => _runPostback_({ action: 'end' })],
    ['PB 欠勤',                () => _runPostback_({ action: 'break' })],
    ['PB 一覧',                () => _runPostback_({ action: 'list', month: '' })],
    ['PB 推移',                () => _runPostback_({ action: 'history' })],
    ['PB ヘルプ',              () => _runPostback_({ action: 'help' })],
    ['PB カレンダー出勤',       () => _runPostback_({ action: 'calendar', type: '出勤' }, { date: '2026-07-22' })],
    ['PB 未登録一覧',           () => _runPostback_({ action: 'unregistered' })],
    ['PB 未登録_退社入力',      () => _runPostback_({ action: 'fill-punch', date: '2026-07-22', field: 'end' }, { time: '19:30' })],
    ['PB 今週の状況',           () => _runPostback_({ action: 'weekly' })],
    ['PB 提出状況',            () => _runPostback_({ action: 'submit-status' })],
    ['PB 着地見込み',          () => _runPostback_({ action: 'forecast' })],
    ['PB 勤務表を開く',        () => _runPostback_({ action: 'workbook' })],
  ];

  let passed = 0;
  let failed = 0;
  suite.forEach(([name, fn]) => {
    try {
      Logger.log(`\n--- ${name} ---`);
      fn();
      passed++;
    } catch (e) {
      Logger.log(`[ERROR] ${e.message}`);
      failed++;
    }
  });

  MainProc.disableTestMode();
  Logger.log(`\n========== 全テスト終了: ${passed}件成功 / ${failed}件失敗 ==========`);
}
