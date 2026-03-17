/**
 * メニュー表示
 */
const notificationMenuDisp = (replyToken) => {
  const columns = [];
  columns.push(LineUtil.getCarouselColumn('https://placehold.jp/001df5/ffffff/640x480.png?text=当日勤怠', '', '入力する勤怠を選択してください。', [
    {
      'type': 'postback',
      'label': '勤務開始',
      'data': JSON.stringify({ 'action': 'start' }),
    },
    {
      'type': 'postback',
      'label': '勤務終了',
      'data': JSON.stringify({ 'action': 'end' }),
    },
    {
      'type': 'postback',
      'label': '欠勤',
      'data': JSON.stringify({ 'action': 'break' }),
    },
  ]));
  const now = new Date();
  const minDate = Utilities.formatDate(new Date(now.getFullYear(), now.getMonth(), 1), 'JST', "yyyy-MM-dd");
  const maxDate = Utilities.formatDate(new Date(now.getFullYear(), now.getMonth() + 1, 0), 'JST', "yyyy-MM-dd");
  columns.push(LineUtil.getCarouselColumn('https://placehold.jp/001df5/ffffff/640x480.png?text=カレンダー', '', '入力する勤怠を選択してください。', [
    {
      'type': 'datetimepicker',
      'label': '出退勤',
      'data': JSON.stringify({ 'action': 'calendar', 'type': TYPE.WORKING }),
      'mode': 'datetime',
      'min': minDate + 'T00:00',
      'max': maxDate + 'T23:59',
    },
    {
      'type': 'datetimepicker',
      'label': '欠勤',
      'data': JSON.stringify({ 'action': 'calendar', 'type': TYPE.REST }),
      'mode': 'date',
      'min': minDate,
      'max': maxDate,
    },
    {
      'type': 'datetimepicker',
      'label': 'クリア',
      'data': JSON.stringify({ 'action': 'calendar', 'type': TYPE.CLEAR }),
      'mode': 'date',
      'min': minDate,
      'max': maxDate,
    },
  ]));
  columns.push(LineUtil.getCarouselColumn('https://placehold.jp/10f500/ffffff/640x480.png?text=その他', '', 'その他', [
    {
        "type": "postback",
        "label": "ヘルプ",
        'data': JSON.stringify({ 'action': 'help' }),
    },
    {
        "type": "postback",
        "label": "提出",
        'data': JSON.stringify({ 'action': 'handin' }),
    },
    {
        "type": "postback",
        "label": "コピー",
        'data': JSON.stringify({ 'action': 'copy' }),
    },
  ]));
  const props = PropertiesService.getScriptProperties().getProperties();
  LineUtil.replayCarousel(props.LINE_CHANNEL_TOKEN, replyToken, 'メニューが表示されました。', columns);
}

