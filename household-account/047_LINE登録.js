const MainProcLineRegist = (() => {
  // 固定タイトル
  const TITLE = 'Line自動登録';
  // 入力状態のキャッシュ保持秒数
  const STATE_TTL = 600;
  // フォールバックFlexグリッドの列数
  const GRID_COLUMNS = 2;
  // クイックリプライの最大件数（超過時はカルーセルにフォールバック）
  const QUICK_REPLY_MAX = 13;
  // カルーセル1カードあたりの件数とカード数上限
  const CAROUSEL_PAGE = 8;
  const CAROUSEL_MAX = 12;

  const cache = () => CacheService.getUserCache();
  const token = () => Props.getValue(PKeys.LINE_CHANNEL_TOKEN);

  /**
   * 送信者が本人かどうかを判定します。
   * Webアプリは匿名公開のため、userId で本人以外の操作を拒否します。
   * （GASのdoPostではHTTPヘッダが取得できず署名検証は不可）
   */
  const isOwner = (event) => {
    const uid = event && event.source && event.source.userId;
    return !!uid && uid === Props.getValue(PKeys.LINE_USER_ID);
  };

  const replyText = (replyToken, msg) => LineUtil.replyText(token(), replyToken, msg);
  const replyFlex = (replyToken, altText, contents) => LineUtil.replyFlex(token(), replyToken, altText, contents);
  const replyQuick = (replyToken, msg, actions) => LineUtil.replyQuickText(token(), replyToken, msg, actions);

  /**
   * マスタの名前付き範囲から選択肢一覧を取得します。
   */
  const getMasterList = (rangeName) => {
    const rng = SpreadsheetApp.getActiveSpreadsheet().getRangeByName(rangeName);
    if (!rng) return [];
    return rng.getValues().flat().filter((v) => v !== '' && v !== null);
  };

  // ---- 選択肢の使用頻度（よく使う順に並べる） ----
  const getUsage = () => {
    const raw = Props.getValue(PKeys.SELECT_USAGE);
    return raw ? JSON.parse(raw) : {};
  };
  const bumpUsage = (kind, value) => {
    if (!value) return;
    const u = getUsage();
    u[kind] = u[kind] || {};
    u[kind][value] = (u[kind][value] || 0) + 1;
    Props.setValue(PKeys.SELECT_USAGE, JSON.stringify(u));
  };
  // 使用回数の降順（同数はマスタの元順を維持する安定ソート）
  const sortByUsage = (items, kind) => {
    const counts = getUsage()[kind] || {};
    return items
      .map((v, i) => ({ v, i, c: counts[String(v)] || 0 }))
      .sort((a, b) => b.c - a.c || a.i - b.i)
      .map((x) => x.v);
  };

  /**
   * 選択肢を返信します。
   * 13件以内はクイックリプライ（高さゼロ・1タップ）、超過時はFlexグリッドにフォールバック。
   */
  const replySelect = (replyToken, title, items, step, stateKey) => {
    const dataOf = (v) => JSON.stringify({ s: step, k: stateKey, v: String(v) });

    if (items.length <= QUICK_REPLY_MAX) {
      const actions = items.map((v) => LineUtil.makeQuickReply({
        type: 'postback',
        label: String(v).slice(0, 20), // クイックリプライのラベルは最大20文字
        data: dataOf(v),
        displayText: String(v),
      }));
      replyQuick(replyToken, title, actions);
      return;
    }

    // 14件以上はカルーセル（横スワイプ）。1カードあたり CAROUSEL_PAGE 件。
    const pages = Math.ceil(items.length / CAROUSEL_PAGE);
    const bubbles = [];
    for (let i = 0; i < items.length && bubbles.length < CAROUSEL_MAX; i += CAROUSEL_PAGE) {
      const chunk = items.slice(i, i + CAROUSEL_PAGE).map((v) => ({ label: String(v), data: dataOf(v), displayText: String(v) }));
      const pageNo = Math.floor(i / CAROUSEL_PAGE) + 1;
      bubbles.push(LineUtil.getFlexButtonGrid(`${title}  (${pageNo}/${pages})`, chunk, GRID_COLUMNS));
    }
    replyFlex(replyToken, title, { type: 'carousel', contents: bubbles });
  };

  const row = (key, value) => ({
    type: 'box',
    layout: 'baseline',
    contents: [
      { type: 'text', text: key, size: 'sm', color: '#888888', flex: 2 },
      { type: 'text', text: String(value), size: 'sm', color: '#333333', wrap: true, flex: 5 },
    ],
  });

  /**
   * 登録完了の確認カードを生成します（取消ボタン付き）。
   */
  const buildConfirmCard = (state, pageId) => ({
    type: 'bubble',
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents: [
        { type: 'text', text: '✅ 登録しました', weight: 'bold', size: 'lg', color: '#1DB446' },
        { type: 'separator', margin: 'md' },
        row('金額', `${state.amount.toLocaleString()}円`),
        row('カテゴリ', state.category),
        row('支払方法', state.method),
        row('備考', state.note || '-'),
        row('日付', DateUtils.formatDate(new Date(), 'yyyy-MM-dd')),
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'button',
          style: 'secondary',
          height: 'sm',
          action: LineUtil.makePostbackAction('取消', JSON.stringify({ s: 'cancel', p: pageId }), '取消'),
        },
      ],
    },
  });

  const HELP = [
    '【使い方】',
    '・支出登録：「金額 メモ」を送信',
    '　例）1500 ランチ',
    '　→ カテゴリ・支払方法を選んで登録',
    '・今月の合計：「合計」',
    '・このヘルプ：「使い方」',
  ].join('\n');

  /**
   * 今月の支出を集計します。
   * @return { total, byCategory:Map }
   */
  const buildMonthSummary = () => {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextFirst = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const filter = new NotionFilter([
      new NotionFilterItem(Constants.PROPERTY_SPENDING.DATE, 'date', 'on_or_after', first),
      new NotionFilterItem(Constants.PROPERTY_SPENDING.DATE, 'date', 'before', nextFirst),
    ]);
    const pages = NotionApi.getPages(Props.getValue(PKeys.DATA_SOURCE_ID_SPENDING), filter);
    let total = 0;
    const byCategory = new Map();
    for (const p of pages) {
      const props = p.properties;
      const amount = (props[Constants.PROPERTY_SPENDING.AMOUNT] || {}).number || 0;
      const catProp = props[Constants.PROPERTY_SPENDING.CATEGORY];
      const cat = (catProp && catProp.select && catProp.select.name) || '未分類';
      total += amount;
      byCategory.set(cat, (byCategory.get(cat) || 0) + amount);
    }
    return { total, byCategory };
  };

  /**
   * 今月の合計カードを生成します。
   */
  const buildSummaryCard = ({ total, byCategory }) => {
    const sorted = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);
    const contents = [
      { type: 'text', text: `${DateUtils.formatDate(new Date(), 'M月')}の支出合計`, size: 'sm', color: '#888888' },
      { type: 'text', text: `${total.toLocaleString()}円`, weight: 'bold', size: 'xxl', color: '#1DB446' },
      { type: 'separator', margin: 'md' },
    ];
    if (sorted.length === 0) {
      contents.push({ type: 'text', text: '登録がありません', size: 'sm', color: '#888888', margin: 'md' });
    } else {
      for (const [cat, amt] of sorted) {
        contents.push({
          type: 'box',
          layout: 'horizontal',
          margin: 'sm',
          contents: [
            { type: 'text', text: cat, size: 'sm', color: '#555555', flex: 7, wrap: true },
            { type: 'text', text: `${amt.toLocaleString()}円`, size: 'sm', color: '#333333', align: 'end', flex: 3 },
          ],
        });
      }
    }
    return { type: 'bubble', body: { type: 'box', layout: 'vertical', spacing: 'sm', contents } };
  };

  /**
   * テキスト受信処理。コマンド or 「金額 メモ」を解析します。
   */
  const handleMessage = (replyToken, message) => {
    if (message.type !== 'text') return;
    const text = message.text.trim();
    // コマンド
    if (text === '使い方' || text === 'ヘルプ' || /^help$/i.test(text)) {
      replyText(replyToken, HELP);
      return;
    }
    if (text === '合計' || text === '今月') {
      replyFlex(replyToken, '今月の合計', buildSummaryCard(buildMonthSummary()));
      return;
    }
    // 支出登録：「金額 メモ」
    const m = text.match(/^([\d,]+)(?:\s+([\s\S]+))?$/);
    if (!m) {
      replyText(replyToken, '「金額 メモ」の形式で送ってください。\n例）1500 ランチ\n（「使い方」でヘルプ表示）');
      return;
    }
    const state = {
      amount: Number(m[1].replace(/,/g, '')),
      note: m[2] ? m[2].trim() : '',
    };
    const categories = sortByUsage(getMasterList(Constants.SHEET_MASTER.RNG_NAME.LINE_CATEGORY), 'cat');
    if (categories.length === 0) {
      replyText(replyToken, 'カテゴリのマスタが見つかりませんでした。');
      return;
    }
    const stateKey = Utilities.getUuid().slice(0, 8);
    cache().put(stateKey, JSON.stringify(state), STATE_TTL);
    replySelect(replyToken, `カテゴリを選択（${state.amount.toLocaleString()}円）`, categories, 'cat', stateKey);
  };

  /**
   * 状態をキャッシュから取得します。期限切れ時は null。
   */
  const loadState = (stateKey) => {
    const raw = cache().get(stateKey);
    return raw ? JSON.parse(raw) : null;
  };

  /**
   * ポストバック受信処理（カテゴリ選択→支払方法選択→登録／取消）。
   */
  const handlePostback = (replyToken, postback) => {
    const data = JSON.parse(postback.data);
    switch (data.s) {
      case 'cat': {
        const state = loadState(data.k);
        if (!state) return replyText(replyToken, '入力の有効期限が切れました。最初からやり直してください。');
        state.category = data.v;
        cache().put(data.k, JSON.stringify(state), STATE_TTL);
        const methods = sortByUsage(getMasterList(Constants.SHEET_MASTER.RNG_NAME.LINE_METHOD_PAY), 'pay');
        if (methods.length === 0) return replyText(replyToken, '支払方法のマスタが見つかりませんでした。');
        replySelect(replyToken, '支払方法を選択', methods, 'pay', data.k);
        return;
      }
      case 'pay': {
        const state = loadState(data.k);
        if (!state) return replyText(replyToken, '入力の有効期限が切れました。最初からやり直してください。');
        state.method = data.v;
        const page = LocalUtils.getCreateSpending({
          title: TITLE,
          category: state.category,
          date: new Date(),
          amount: state.amount,
          methodPay: state.method,
          note: state.note,
        });
        const res = NotionApi.createPage(page);
        if (res && res.id) {
          cache().remove(data.k);
          // よく使う順の並べ替え用に使用回数を記録
          bumpUsage('cat', state.category);
          bumpUsage('pay', state.method);
          replyFlex(replyToken, '登録しました', buildConfirmCard(state, res.id));
        } else {
          replyText(replyToken, '登録に失敗しました。');
        }
        return;
      }
      case 'cancel': {
        NotionApi.deletePage(data.p);
        replyText(replyToken, '🗑️ 登録を取り消しました。');
        return;
      }
    }
  };

  return {
    handle: (event) => {
      if (!isOwner(event)) return;
      switch (event.type) {
        case 'message':
          handleMessage(event.replyToken, event.message);
          return;
        case 'postback':
          handlePostback(event.replyToken, event.postback);
          return;
      }
    },
  };
})();

/**
 * LINE Messaging API の Webhook 受信ハンドラ
 */
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const events = body.events || [];
    for (const event of events) {
      MainProcLineRegist.handle(event);
    }
  } catch (err) {
    Logger.log(err);
  }
  // LINEへは常に200を返す
  return ContentService.createTextOutput('OK');
}
