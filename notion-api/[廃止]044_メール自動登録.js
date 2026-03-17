const MainProcMail = (function () {
  const isDebug = false;

  // 家計簿自動登録設定リスト
  const autoRegistSettingList = [
    {
      'NO': 1,
      'TITLE': '楽天ペイ',
      'METHOD_PAY': '楽天ペイ',
      'SEARCH_WORD': 'label:家計簿 is:starred from:(no-reply@pay.rakuten.co.jp)',
      'USE_AI': true,
      'PATTERN_DATE': 'ご利用日時\\s+([\\d/]+\\(\\S\\)\\s([\\d:]+))',
      //'PATTERN_SHOP': ['ご利用店舗\\s+(.+)', 'お支払先\\s+(.+)'],
      'PATTERN_SHOP': ['ご利用店舗\\s+(.+?)(?:\\s{2,}|[\\r\\n])', 'お支払先\\s+(.+)'],
      'PATTERN_AMOUNT': '決済総額\\s+([\\d,]+)',
    },
    {
      'NO': 2,
      'TITLE': 'Amazon',
      'METHOD_PAY': 'Amazon Master Card',
      'SEARCH_WORD': 'label:家計簿 is:starred from:(auto-confirm@amazon.co.jp) subject:(注文済み: )',
      'USE_AI': true,
      'SEARCH_AREA': {
        'START': '注文番号',
      },
      'PATTERN_AMOUNT': '合計\\s([\\d]+)',
      'PATTERN_URL': '注文番号\\s(\\d{3}-\\d{7}-\\d{7})',
      'URL_FORMAT': 'https://www.amazon.co.jp/gp/your-account/order-details/?orderID={0}'
    },
    {
      'NO': 3,
      'TITLE': 'Amazon',
      'METHOD_PAY': 'Amazon Master Card',
      'SEARCH_WORD': 'label:家計簿 is:starred from:(auto-confirm@amazon.co.jp)',
      'USE_AI': true,
      'SEARCH_AREA': {
        'START': '領収書/購入明細書',
        'END': 'Amazon.co.jp でのご注文について詳しくは',
      },
      'SEARCH_ITEM': {
        'START': '注文番号',
        'END': '==========',
      },
      'PATTERN_DATE': '注文日：\\s([\\d/]+)',
      'PATTERN_AMOUNT': '注文合計：\\s￥\\s([\\d,]+)',
      'PATTERN_URL': '注文番号：\\s([\\d-]+)',
      'URL_FORMAT': 'https://www.amazon.co.jp/gp/your-account/order-details/?orderID={0}'
    },
    // {
    //   'TITLE': 'Amazon',
    //   'METHOD_PAY': 'Amazon Master Card',
    //   'SEARCH_WORD': 'label:家計簿 is:starred from:(digital-no-reply@amazon.co.jp) subject:(Amazon.co.jpでのご注文)',
    //   'PATTERN_AMOUNT': '商品の小計:\\s+￥\\s([\\d,]+)',
    //   'PATTERN_URL': '注文番号:\\s([\\w-]+)',
    //   'PATTERN_NOTE': '注文内容[\\s\\S]*注文合計:[\\s￥\\d\\.,]*(.*)',
    //   'PATTERN_NOTE_FLGS': '',
    //   'URL_FORMAT': 'https://www.amazon.co.jp/gp/your-account/order-details/?orderID={0}'
    // },
    // {
    //   'TITLE': 'Amazon',
    //   'METHOD_PAY': 'Amazon Master Card',
    //   'SEARCH_WORD': 'label:家計簿 is:starred from:(digital-no-reply@amazon.co.jp) subject:(Amazon.comでのご注文)',
    //   'PATTERN_AMOUNT': '商品の小計:\\s+￥\\s([\\d,]+)',
    //   'PATTERN_URL': 'Order\\s#\\[([\\w-]+)\\]',
    //   'PATTERN_NOTE': '(?<=My\\salt\\s\\(https:\\/\\/www\\.amazon\\.com\\)\\s)([\\s\\S]*?)(?=商品の小計)',
    //   'PATTERN_NOTE_FLGS': '',
    //   'URL_FORMAT': 'https://www.amazon.co.jp/gp/your-account/order-details/?orderID={0}'
    // },
    {
      'NO': 4,
      'TITLE': 'Amazon',
      'METHOD_PAY': 'Amazon Master Card',
      'SEARCH_WORD': 'label:家計簿 is:starred from:(digital-no-reply@amazon.co.jp) subject:(Amazon.co.jp)',
      'USE_AI': true,
      'PATTERN_AMOUNT': '小計:\\s+￥\\s([\\d,]+)',
      'PATTERN_URL': '注文番号:\\s([\\w-]+)',
      'PATTERN_NOTE': '(?<=My\\salt\\s\\(https:\\/\\/www\\.amazon\\.co\\.jp[^\\)]*\\)\\s*\\n)([\\s\\S]*?)(?=\\n販売者：)',
      'PATTERN_NOTE_FLGS': 'g',
      'URL_FORMAT': 'https://www.amazon.co.jp/gp/your-account/order-details/?orderID={0}'
    },
    {
      'NO': 5,
      'TITLE': 'Amazon',
      'METHOD_PAY': 'Amazon Master Card',
      'SEARCH_WORD': 'label:家計簿 is:starred from:(digital-no-reply@amazon.co.jp) subject:(Amazon.comでのご注文)',
      'USE_AI': true,
      'PATTERN_AMOUNT': '小計:\\s+￥\\s([\\d,]+)',
      'PATTERN_URL': 'Order\\s#([\\w-]+)',
      'PATTERN_NOTE': '(?<=My\\salt\\s\\(https:\\/\\/www\\.amazon\\.com\\)\\s\\n)([\\s\\S]*?)(?=\\nSold\\sBy)',
      'PATTERN_NOTE_FLGS': 'g',
      'URL_FORMAT': 'https://www.amazon.co.jp/gp/your-account/order-details/?orderID={0}'
    },
    {
      'NO': 6,
      'TITLE': '楽天市場',
      'METHOD_PAY': '楽天カード',
      'SEARCH_WORD': 'label:家計簿 is:starred from:(order@rakuten.co.jp)',
      'USE_AI': true,
      'PATTERN_DATE': '\\[日時\\]\\s+([\\d\\s-:]+)',
      'PATTERN_AMOUNT': '支払い金額\\s+([\\d,]+)',
      'PATTERN_URL': '\\[受注番号\\]\\s+([\\d]+)-([\\d-]+)',
      'URL_FORMAT': 'https://order.my.rakuten.co.jp/?act=detail_view&shop_id={0}&order_number={0}-{1}'
    },
    {
      'NO': 7,
      'TITLE': 'マイプロテイン',
      'METHOD_PAY': 'リクルートカード',
      'SEARCH_WORD': 'label:家計簿 is:starred from:(service@t.myprotein.com)',
      'PATTERN_DATE': '注文日時:\\s([\\d-]+\\s[\\d:]+)',
      'PATTERN_AMOUNT': '合計金額:\\s¥([\\d,]+)',
      'PATTERN_URL': '注文番号:\\s([\\d]+)',
      'URL_FORMAT': 'https://www.myprotein.jp/account/my-account/my-orders/{0}'
    },
    {
      'NO': 8,
      'TITLE': '楽天カード',
      'METHOD_PAY': '楽天カード',
      'SEARCH_WORD': 'label:家計簿 is:starred from:(info@mail.rakuten-card.co.jp)',
      'USE_AI': true,
      'SEARCH_AREA': {
        'START': '<カードご利用情報>',
        'END': '■ご利用明細のご確認',
      },
      'SEARCH_ITEM': {
        'START': '■利用日',
        // 'END': '■ポイント獲得予定月',
        'END': '■支払月',
      },
      'PATTERN_DATE': '利用日:\\s+([\\d/]+)',
      'PATTERN_SHOP': '利用先:\\s(.+)',
      'PATTERN_AMOUNT': '利用金額:\\s+([\\d,]+)',
    },
    {
      'NO': 9,
      'TITLE': '三井住友カード',
      'METHOD_PAY': '三井住友VISA（NL）',
      'SEARCH_WORD': 'label:家計簿 is:starred from:(statement@vpass.ne.jp)',
      'USE_AI': true,
      'PATTERN_DATE': '利用日：([\\d/]+\\s([\\d:]+))',
      'PATTERN_SHOP': '利用先：(.+)',
      'PATTERN_AMOUNT': '利用金額：([\\d,]+)',
    }
  ];

  /**
   * 正規表現で最初にマッチした1件目の値を取得します。
   * @param {string} body - メール本文
   * @param {string} pattern - 正規表現パターン
   * @return {string|null} マッチした値または null
   */
  const getFirstMatch = (body, pattern) => {
    if (!pattern) return null;
    const match = body.match(new RegExp(pattern));
    return match ? match[1] : null;
  }

  /**
   * 正規表現でマッチしたすべての値を配列で取得します。
   * @param {string} body - メール本文
   * @param {string} pattern - 正規表現パターン
   * @param {string} [flags=""] - 正規表現フラグ
   * @return {Array<string>} マッチした値の配列
   */
  const getMatches = (body, pattern, flags = "") => {
    if (!pattern) return [];
    const matches = body.match(new RegExp(pattern, flags));
    return matches || [];
  }

  /**
   * 利用日時を取得します。マッチしない場合は fallbackDate を使用します。
   * @param {string} body - メール本文
   * @param {string} pattern - 日付抽出用パターン
   * @param {Date} fallbackDate - マッチしなかった場合の代替日付
   * @return {Date} 利用日付
   */
  const getUseDate = (body, pattern, fallbackDate) => {
    const match = getFirstMatch(body, pattern);
    return match ? new Date(match) : fallbackDate;
  }

  /**
   * 店舗名と備考を抽出します。
   * @param {string} body - メール本文
   * @param {string|Array<string>} patterns - 店舗抽出用パターン
   * @param {string} title - デフォルトタイトル
   * @param {Array<string>} shopList - 店舗一覧
   * @return {{name: string, note: string}} 店舗情報
   */
  const getShopName = (body, patterns, title, shopList) => {
    const result = { name: '', note: '' };
    if (!patterns) {
      result.name = title;
      return result; 
    }

    const normalizedPatterns = Array.isArray(patterns) ? patterns : [ patterns ];
    for (const pattern of normalizedPatterns) {
      const match = getFirstMatch(body, pattern);
      if (!match) continue;
      result.note = match;
      const temp = match.normalize('NFKC');
      result.name = shopList.find(shop => temp.includes(shop)) || '';
      break;
    }
    return result;
  }

  /**
   * 金額を抽出し、数値として返します。
   * @param {string} body - メール本文
   * @param {string} pattern - 金額抽出用パターン
   * @return {number} 金額（数値）
   */
  const getAmount = (body, pattern) => {
    const match = getFirstMatch(body, pattern);
    return match ? Number(match.replace(/,/g, '')) : 0;
  }

  /**
   * 正規表現からURLを構築します。
   * @param {string} body - メール本文
   * @param {string} pattern - パターン
   * @param {string} format - URL フォーマット文字列（例： "https://example.com/{0}/{1}"）
   * @return {string} 生成されたURL
   */
  const getUrl = (body, pattern, format) => {
    const matches = getMatches(body, pattern);
    if (!matches.length) return '';
    matches.shift(); // remove full match
    return format
      ? matches.reduce((url, val, i) => url.replaceAll(`{${i}}`, val), format)
      : matches[0];
  }

  /**
   * 備考を抽出して返します。
   * @param {string} body - メール本文
   * @param {string} pattern - 正規表現パターン
   * @param {string} flags - 正規表現フラグ
   * @return {string} 備考テキスト
   */
  const getNote = (body, pattern, flags = '') => {
    const matches = getMatches(body, pattern, flags);
    if (!matches) return '';
    return flags.includes('g') ? matches.join('\n') : matches[1]?.trim() || '';
  }

  /**
   * 特定範囲のテキストを抽出します。
   * @param {string} text - 全体テキスト
   * @param {string} start - 開始文字列
   * @param {string} end - 終了文字列
   * @return {string} 抽出テキスト
   */
  const getSearchArea = (text, start, end) => {
    const startIdx = start ? text.indexOf(start) : 0;
    const fromStart = startIdx > -1 ? text.slice(startIdx) : text;
    const endIdx = end ? fromStart.indexOf(end) : -1;
    return endIdx > -1 ? fromStart.slice(0, endIdx) : fromStart;
  }

  /**
   * 繰り返しパターンで複数アイテムを抽出します。
   * @param {string} text - 対象テキスト
   * @param {string} start - 開始文字列
   * @param {string} end - 終了文字列
   * @return {Array<string>} アイテム配列
   */
  const getSearchItems = (text, start, end) => {
    const items = [];
    let temp = text;
    while (true) {
      const startIdx = temp.indexOf(start);
      if (startIdx === -1) break;

      const substr = temp.slice(startIdx);
      const endIdx = substr.indexOf(end);
      if (endIdx === -1) break;

      items.push(substr.slice(0, endIdx));
      temp = substr.slice(endIdx);
    }
    return items;
  }

  /**
   * LINE通知用のメッセージリストを構築します。
   * @param {Date} date - 利用日付
   * @param {object} shopData - 店舗情報
   * @param {number} amount - 金額
   * @param {string} method - 支払方法
   * @param {string} url - 関連URL
   * @param {string} note - 備考
   * @return {string} メッセージ文字列
   */
  const buildMsgList = (date, shopData, amount, method, url, note) => {
    const msg = [
      `利用日時：${DateUtils.formatDate(date, "yyyy-MM-dd HH:mm")}`,
      `利用店舗：${shopData.note || shopData.name}`,
      `支払方法：${method}`,
      `決済金額：${amount.toLocaleString()}円`,
    ];
    if (url) msg.push(`URL：${url}`);
    if (note) msg.push(`備考: ${note}`);
    return msg.join('\n');
  }

  /**
   * LINE通知を送信します。
   * @param {Array<string>} messages - 通知メッセージリスト
   */
  const notifyLine = (messages) => {
    if (messages.length > 1 && !isDebug) {
      LineUtil.postText(Props.getValue(PKeys.LINE_CHANNEL_TOKEN), Props.getValue(PKeys.LINE_USER_ID), messages.join('\n\n'));
    }
  }

  return {
    /**
     * メール本文を解析し、家計簿データを自動登録します。
     */
    create: () => {
      const shopList = SpreadsheetApp.getActiveSpreadsheet().getRangeByName('お店').getValues().flat();
      const autoRegistSettings = Props.getMap(PKeys.AUTO_REGIST_SETTING_LIST);
      
      const msgList = {
        'SUCCESS': [ '家計簿の登録に成功しました。' ],
        'FAIL': [ '家計簿の登録に失敗しました。' ],
        'SKIP': [ '家計簿の登録をスキップしました。' ],
      };
      for (const setting of autoRegistSettings) {
        if (setting.USE_AI) {
          continue;      
        }
        const threads = GmailApp.search(setting.SEARCH_WORD);
        for (const thread of threads) {
          for (const message of thread.getMessages()) {
            if (!message.isStarred()) continue;

            let body = message.getPlainBody();
            Logger.log(setting.NO);
            Logger.log(body);
            if (setting.SEARCH_AREA) {
              // 検索エリア指定がある場合、検索指定エリアに置き換え
              body = getSearchArea(body, setting.SEARCH_AREA.START, setting.SEARCH_AREA.END);
            }

            const items = setting.SEARCH_ITEM
              ? getSearchItems(body, setting.SEARCH_ITEM.START, setting.SEARCH_ITEM.END)
              : [ body ];
            
            let isSuccess = true;

            for (const item of items) {
              const date = getUseDate(item, setting.PATTERN_DATE, message.getDate());
              const shopData = getShopName(item, setting.PATTERN_SHOP, setting.TITLE, shopList);
              const amount = getAmount(item, setting.PATTERN_AMOUNT)
              const url = getUrl(item, setting.PATTERN_URL, setting.URL_FORMAT)
              const note = getNote(item, setting.PATTERN_NOTE, setting.PATTERN_NOTE_FLGS);

              let res;
              // if (amount > 0) {
                // 年間収支テーブルから対象月のページIDを取得
                const monthPageId = LocalUtils.getPageIdFromPropByTitle(
                  PKeys.INCOME_AND_SPENDING_MAP,
                  LocalUtils.getDatabaseId(date.getFullYear(), Constants.DATABASE_ID.INCOME_AND_SPENDING),
                  DateUtils.formatDate(date, "MM月")
                );
                const page = LocalUtils.getCreateSpending({
                  title: `${setting.TITLE}自動登録`,
                  date,
                  monthPageId,
                  amount,
                  shop: shopData.name,
                  methodPay: setting.METHOD_PAY,
                  url,
                  note: note || shopData.note,
                });

                if (!isDebug) {
                  res = LocalUtils.createPage(page);
                }
              // }

              const msg = buildMsgList(date, shopData, amount, setting.METHOD_PAY, url, note);
              Logger.log(msg);

              if (amount === 0) {
                msgList.SKIP.push(msg);
              } else if (res) {
                msgList.SUCCESS.push(msg);
              } else {
                msgList.FAIL.push(msg);
                isSuccess = false
              }
            }
            if (isSuccess && !isDebug) {
              message.unstar();
            }
          }
        }
      }

      notifyLine(msgList.SUCCESS);
      notifyLine(msgList.SKIP);
      notifyLine(msgList.FAIL);
    }
  };
})();

/**
 * メールから家計簿登録
 */
function CreateHouseholdAccountFromMail() {
  MainProcMail.create();
}