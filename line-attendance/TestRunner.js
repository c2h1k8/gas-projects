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

/** テスト: 欠勤連絡（テキスト形式） */
function test_message_欠勤連絡() {
  _setupTest_();
  _runMessage_('休 20260318 体調不良のため休みます');
  _teardownTest_();
}

/** テスト: 客先休業連絡（テキスト形式） */
function test_message_客先休連絡() {
  _setupTest_();
  _runMessage_('客先休 20260318 20260319');
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

/** テスト: ヘルプポストバック */
function test_postback_ヘルプ() {
  _setupTest_();
  _runPostback_({ action: 'help' });
  _teardownTest_();
}

/** テスト: カレンダー登録ポストバック（日時選択後） */
function test_postback_カレンダー() {
  _setupTest_();
  _runPostback_({ action: 'calendar', type: '出勤' }, { datetime: '2026-03-18T09:00' });
  _teardownTest_();
}

/** テスト: 勤怠連絡フロー ステップ1（From日付選択後） */
function test_postback_勤怠連絡_step1() {
  _setupTest_();
  _runPostback_({ action: 'absence-mail' }, { date: '2026-03-18' });
  _teardownTest_();
}

/** テスト: 勤怠連絡フロー ステップ2（種別選択後、期間なし） */
function test_postback_勤怠連絡_step2_期間なし() {
  _setupTest_();
  _runPostback_({ action: 'absence-mail', times: 1, type: 'OVER_WORK', from: '2026-03-18' });
  _teardownTest_();
}

/** テスト: 勤怠連絡フロー ステップ2（種別選択後、期間あり） */
function test_postback_勤怠連絡_step2_期間あり() {
  _setupTest_();
  _runPostback_({ action: 'absence-mail', times: 1, type: 'REST', from: '2026-03-18' });
  _teardownTest_();
}

/** テスト: 勤怠連絡フロー ステップ3（To日付選択後 → 送信） */
function test_postback_勤怠連絡_step3() {
  _setupTest_();
  _runPostback_({ action: 'absence-mail', times: 2, type: 'REST', from: '2026-03-18' }, { date: '2026-03-19' });
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
    ['MSG 欠勤連絡',           () => _runMessage_('休 20260318 体調不良')],
    ['PB 出勤',                () => _runPostback_({ action: 'start' })],
    ['PB 退勤',                () => _runPostback_({ action: 'end' })],
    ['PB 欠勤',                () => _runPostback_({ action: 'break' })],
    ['PB 一覧',                () => _runPostback_({ action: 'list', month: '' })],
    ['PB ヘルプ',              () => _runPostback_({ action: 'help' })],
    ['PB 勤怠連絡step1',       () => _runPostback_({ action: 'absence-mail' }, { date: '2026-03-18' })],
    ['PB 勤怠連絡step2期間なし', () => _runPostback_({ action: 'absence-mail', times: 1, type: 'OVER_WORK', from: '2026-03-18' })],
    ['PB 勤怠連絡step3',       () => _runPostback_({ action: 'absence-mail', times: 2, type: 'REST', from: '2026-03-18' }, { date: '2026-03-19' })],
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
