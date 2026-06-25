/**
 * リッチメニュー（3ページ・タブ切替）をAPIで登録するセットアップ。
 *
 * 事前準備:
 *   1) 下記の名前で画像を Google Drive にアップロード（フォルダはどこでもOK）
 *        RICHMENU_IMG_A_NAME / RICHMENU_IMG_B_NAME / RICHMENU_IMG_C_NAME
 *      ※ 上部タブは3分割（左:登録 / 中:連絡・提出 / 右:状況確認）に揃えること。
 *   2) 本関数 SetupRichMenu を一度だけ実行
 *
 * 画像はファイル名でDrive全体から検索するため、ファイルIDやフォルダ指定は不要です。
 * 何度実行しても良いように、既存のメニュー・エイリアスは削除してから作り直します。
 *
 * ページ構成:
 *   A=登録（する）  : 出社/退社/欠勤、カレンダー出勤/欠勤/クリア
 *   B=連絡・提出（送る）: 当月稼働/先月稼働/推移、欠勤連絡/提出/ヘルプ
 *   C=状況確認（見る）: 連絡状況/勤怠チェック/提出状況、着地見込み/勤務表を開く/翌月作成
 */

// Driveに置くリッチメニュー画像のファイル名（一意にしておくこと）
const RICHMENU_IMG_A_NAME = 'line-attendance-richmenu-a.png';
const RICHMENU_IMG_B_NAME = 'line-attendance-richmenu-b.png';
const RICHMENU_IMG_C_NAME = 'line-attendance-richmenu-c.png';

const RICHMENU_SIZE = { width: 1200, height: 810 };

// 上部タブ（3分割）。全ページ共通でA/B/Cへ切り替える。
// タップしやすいよう高さ132px（ボタン行は各339px、合計810pxを維持）。
const RICHMENU_TAB_AREAS = [
  { bounds: { x: 0, y: 0, width: 400, height: 132 }, action: { type: 'richmenuswitch', richMenuAliasId: 'richmenu-alias-a', data: '{"action":"richmenu-alias-a"}' } },
  { bounds: { x: 400, y: 0, width: 400, height: 132 }, action: { type: 'richmenuswitch', richMenuAliasId: 'richmenu-alias-b', data: '{"action":"richmenu-alias-b"}' } },
  { bounds: { x: 800, y: 0, width: 400, height: 132 }, action: { type: 'richmenuswitch', richMenuAliasId: 'richmenu-alias-c', data: '{"action":"richmenu-alias-c"}' } },
];

const RICHMENU_A = {
  size: RICHMENU_SIZE,
  selected: true,
  name: 'Rich menu A',
  chatBarText: 'メニュー',
  areas: [
    ...RICHMENU_TAB_AREAS,
    { bounds: { x: 0, y: 132, width: 400, height: 339 }, action: { type: 'postback', data: '{"action":"start"}', inputOption: 'closeRichMenu' } },
    { bounds: { x: 400, y: 132, width: 400, height: 339 }, action: { type: 'postback', data: '{"action":"end"}', inputOption: 'closeRichMenu' } },
    { bounds: { x: 800, y: 132, width: 400, height: 339 }, action: { type: 'postback', data: '{"action":"break"}', inputOption: 'closeRichMenu' } },
    { bounds: { x: 0, y: 471, width: 400, height: 339 }, action: { type: 'datetimepicker', data: '{"action":"calendar","type":"出勤"}', mode: 'datetime', inputOption: 'closeRichMenu' } },
    { bounds: { x: 400, y: 471, width: 400, height: 339 }, action: { type: 'datetimepicker', data: '{"action":"calendar","type":"欠勤"}', mode: 'date', inputOption: 'closeRichMenu' } },
    { bounds: { x: 800, y: 471, width: 400, height: 339 }, action: { type: 'datetimepicker', data: '{"action":"calendar","type":"クリア"}', mode: 'date', inputOption: 'closeRichMenu' } },
  ],
};

const RICHMENU_B = {
  size: RICHMENU_SIZE,
  selected: false,
  name: 'Rich menu B',
  chatBarText: 'メニュー',
  areas: [
    ...RICHMENU_TAB_AREAS,
    { bounds: { x: 0, y: 132, width: 400, height: 339 }, action: { type: 'postback', data: '{"action":"list","month":""}', inputOption: 'closeRichMenu' } },
    { bounds: { x: 400, y: 132, width: 400, height: 339 }, action: { type: 'postback', data: '{"action":"list","month":"1"}', inputOption: 'closeRichMenu' } },
    { bounds: { x: 800, y: 132, width: 400, height: 339 }, action: { type: 'postback', data: '{"action":"history"}', inputOption: 'closeRichMenu' } },
    { bounds: { x: 0, y: 471, width: 400, height: 339 }, action: { type: 'datetimepicker', data: '{"action":"absence-mail"}', mode: 'date', inputOption: 'closeRichMenu' } },
    { bounds: { x: 400, y: 471, width: 400, height: 339 }, action: { type: 'postback', data: '{"action":"handin"}', inputOption: 'closeRichMenu' } },
    { bounds: { x: 800, y: 471, width: 400, height: 339 }, action: { type: 'postback', data: '{"action":"help"}', inputOption: 'closeRichMenu' } },
  ],
};

const RICHMENU_C = {
  size: RICHMENU_SIZE,
  selected: false,
  name: 'Rich menu C',
  chatBarText: 'メニュー',
  areas: [
    ...RICHMENU_TAB_AREAS,
    { bounds: { x: 0, y: 132, width: 400, height: 339 }, action: { type: 'postback', data: '{"action":"contact-status"}', inputOption: 'closeRichMenu' } },
    { bounds: { x: 400, y: 132, width: 400, height: 339 }, action: { type: 'postback', data: '{"action":"contact-check"}', inputOption: 'closeRichMenu' } },
    { bounds: { x: 800, y: 132, width: 400, height: 339 }, action: { type: 'postback', data: '{"action":"submit-status"}', inputOption: 'closeRichMenu' } },
    { bounds: { x: 0, y: 471, width: 400, height: 339 }, action: { type: 'postback', data: '{"action":"forecast"}', inputOption: 'closeRichMenu' } },
    { bounds: { x: 400, y: 471, width: 400, height: 339 }, action: { type: 'postback', data: '{"action":"workbook"}', inputOption: 'closeRichMenu' } },
    { bounds: { x: 800, y: 471, width: 400, height: 339 }, action: { type: 'postback', data: '{"action":"make-schedule"}', inputOption: 'closeRichMenu' } },
  ],
};

function SetupRichMenu() {
  const token = Props.getValue(PKeys.LINE_CHANNEL_TOKEN);

  // 既存のエイリアス・メニューを削除（冪等）
  LineUtil.deleteRichMenuAlias(token, 'richmenu-alias-a');
  LineUtil.deleteRichMenuAlias(token, 'richmenu-alias-b');
  LineUtil.deleteRichMenuAlias(token, 'richmenu-alias-c');
  for (const m of LineUtil.getRichMenuList(token)) {
    LineUtil.deleteRichMenu(token, m.richMenuId);
  }

  // メニュー作成
  const idA = LineUtil.createRichMenu(token, RICHMENU_A);
  const idB = LineUtil.createRichMenu(token, RICHMENU_B);
  const idC = LineUtil.createRichMenu(token, RICHMENU_C);

  // 画像アップロード（Driveからファイル名で検索）
  LineUtil.uploadRichMenuImage(token, idA, getImageBlobByName_(RICHMENU_IMG_A_NAME));
  LineUtil.uploadRichMenuImage(token, idB, getImageBlobByName_(RICHMENU_IMG_B_NAME));
  LineUtil.uploadRichMenuImage(token, idC, getImageBlobByName_(RICHMENU_IMG_C_NAME));

  // エイリアス（A↔B↔C切替用）
  LineUtil.createRichMenuAlias(token, 'richmenu-alias-a', idA);
  LineUtil.createRichMenuAlias(token, 'richmenu-alias-b', idB);
  LineUtil.createRichMenuAlias(token, 'richmenu-alias-c', idC);

  // デフォルト表示＝ページA
  LineUtil.setDefaultRichMenu(token, idA);

  Logger.log(`リッチメニュー登録完了 A=${idA} B=${idB} C=${idC}`);
}

/**
 * ファイル名でDrive全体から画像を検索し Blob を返します。
 * 0件・複数件はエラー（名前を一意にしてください）。
 */
function getImageBlobByName_(name) {
  const it = DriveApp.getFilesByName(name);
  if (!it.hasNext()) throw new Error(`画像が見つかりません: ${name}`);
  const file = it.next();
  if (it.hasNext()) throw new Error(`同名ファイルが複数あります: ${name}（一意にしてください）`);
  return file.getBlob();
}
