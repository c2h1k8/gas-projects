/**
 * リッチメニュー（2ページ・タブ切替）をAPIで登録するセットアップ。
 *
 * 事前準備:
 *   1) 下記の名前で画像を Google Drive にアップロード（フォルダはどこでもOK）
 *        RICHMENU_IMG_A_NAME / RICHMENU_IMG_B_NAME
 *   2) 本関数 SetupRichMenu を一度だけ実行
 *
 * 画像はファイル名でDrive全体から検索するため、ファイルIDやフォルダ指定は不要です。
 * 何度実行しても良いように、既存のメニュー・エイリアスは削除してから作り直します。
 */

// Driveに置くリッチメニュー画像のファイル名（一意にしておくこと）
const RICHMENU_IMG_A_NAME = 'line-attendance-richmenu-a.png';
const RICHMENU_IMG_B_NAME = 'line-attendance-richmenu-b.png';

const RICHMENU_SIZE = { width: 1200, height: 810 };

const RICHMENU_A = {
  size: RICHMENU_SIZE,
  selected: true,
  name: 'Rich menu A',
  chatBarText: 'メニュー',
  areas: [
    { bounds: { x: 600, y: 0, width: 600, height: 90 }, action: { type: 'richmenuswitch', richMenuAliasId: 'richmenu-alias-b', data: '{"action":"richmenu-alias-b"}' } },
    { bounds: { x: 0, y: 90, width: 400, height: 360 }, action: { type: 'postback', data: '{"action":"start"}', inputOption: 'closeRichMenu' } },
    { bounds: { x: 400, y: 90, width: 400, height: 360 }, action: { type: 'postback', data: '{"action":"end"}', inputOption: 'closeRichMenu' } },
    { bounds: { x: 800, y: 90, width: 400, height: 360 }, action: { type: 'postback', data: '{"action":"break"}', inputOption: 'closeRichMenu' } },
    { bounds: { x: 0, y: 450, width: 400, height: 360 }, action: { type: 'datetimepicker', data: '{"action":"calendar","type":"出勤"}', mode: 'datetime', inputOption: 'closeRichMenu' } },
    { bounds: { x: 400, y: 450, width: 400, height: 360 }, action: { type: 'datetimepicker', data: '{"action":"calendar","type":"欠勤"}', mode: 'date', inputOption: 'closeRichMenu' } },
    { bounds: { x: 800, y: 450, width: 400, height: 360 }, action: { type: 'datetimepicker', data: '{"action":"calendar","type":"クリア"}', mode: 'date', inputOption: 'closeRichMenu' } },
  ],
};

const RICHMENU_B = {
  size: RICHMENU_SIZE,
  selected: false,
  name: 'Rich menu B',
  chatBarText: 'メニュー',
  areas: [
    { bounds: { x: 0, y: 0, width: 600, height: 90 }, action: { type: 'richmenuswitch', richMenuAliasId: 'richmenu-alias-a', data: '{"action":"richmenu-alias-a"}' } },
    { bounds: { x: 0, y: 90, width: 400, height: 360 }, action: { type: 'postback', data: '{"action":"list","month":""}', inputOption: 'closeRichMenu' } },
    { bounds: { x: 400, y: 90, width: 400, height: 360 }, action: { type: 'postback', data: '{"action":"list","month":"1"}', inputOption: 'closeRichMenu' } },
    { bounds: { x: 800, y: 90, width: 400, height: 360 }, action: { type: 'postback', data: '{"action":"history"}', inputOption: 'closeRichMenu' } },
    { bounds: { x: 0, y: 450, width: 400, height: 360 }, action: { type: 'datetimepicker', data: '{"action":"absence-mail"}', mode: 'date', inputOption: 'closeRichMenu' } },
    { bounds: { x: 400, y: 450, width: 400, height: 360 }, action: { type: 'postback', data: '{"action":"handin"}', inputOption: 'closeRichMenu' } },
    { bounds: { x: 800, y: 450, width: 400, height: 360 }, action: { type: 'postback', data: '{"action":"help"}', inputOption: 'closeRichMenu' } },
  ],
};

function SetupRichMenu() {
  const token = Props.getValue(PKeys.LINE_CHANNEL_TOKEN);

  // 既存のエイリアス・メニューを削除（冪等）
  LineUtil.deleteRichMenuAlias(token, 'richmenu-alias-a');
  LineUtil.deleteRichMenuAlias(token, 'richmenu-alias-b');
  for (const m of LineUtil.getRichMenuList(token)) {
    LineUtil.deleteRichMenu(token, m.richMenuId);
  }

  // メニュー作成
  const idA = LineUtil.createRichMenu(token, RICHMENU_A);
  const idB = LineUtil.createRichMenu(token, RICHMENU_B);

  // 画像アップロード（Driveからファイル名で検索）
  LineUtil.uploadRichMenuImage(token, idA, getImageBlobByName_(RICHMENU_IMG_A_NAME));
  LineUtil.uploadRichMenuImage(token, idB, getImageBlobByName_(RICHMENU_IMG_B_NAME));

  // エイリアス（A↔B切替用）
  LineUtil.createRichMenuAlias(token, 'richmenu-alias-a', idA);
  LineUtil.createRichMenuAlias(token, 'richmenu-alias-b', idB);

  // デフォルト表示＝ページA
  LineUtil.setDefaultRichMenu(token, idA);

  Logger.log(`リッチメニュー登録完了 A=${idA} B=${idB}`);
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
