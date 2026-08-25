/**
 * 家計簿からの LINE 通知。
 *
 * **送信は money API 経由**（POST /api/notify/push）。Push 枠はチャンネル単位で月200通なのに、
 * GAS が直接投げると money の T_NOTIFY_LOG に載らず、画面の残枠が実際より多く見える。
 * カードの組み立てはこちら（メールの処理結果は GAS しか知らない）、LINE へ投げて記録するのは
 * money、と分けて数える場所を1つに保つ。
 *
 * **money へ送れなかった時だけ LINE へ直送する**。その1通は残枠の勘定から漏れるが、
 * money が落ちていればメール自動登録も全件失敗しており、その通知ごと消えるほうが困る。
 */
const LocalUtils = (function () {
  const KIND = 'mail';

  const token = () => Props.getValue(PKeys.LINE_CHANNEL_TOKEN);
  const userId = () => Props.getValue(PKeys.LINE_USER_ID);

  // メッセージの形は LineUtil に作らせる（絵文字のインデックス付けもあちらの仕事）。
  const push = (message, direct) => {
    if (MoneyApi.pushNotify(KIND, message)) return;
    Logger.log('[LocalUtils] money 経由で送れないため LINE へ直送（この1通は残枠の勘定に載らない）');
    direct();
  };

  return {
    postText: (message, emojis = []) => push(
      LineUtil.getTextData(message, emojis).messages[0],
      () => LineUtil.postText(token(), userId(), message, emojis),
    ),
    postFlex: (altText, contents) => push(
      LineUtil.getFlexData(altText, contents).messages[0],
      () => LineUtil.postFlex(token(), userId(), altText, contents),
    ),
  };
})();
