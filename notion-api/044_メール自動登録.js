const MainProcMailAI = (() => {
  const CONFIG = {
    DEBUG: false,
    MASK: {
      NAME: "[氏名]",
      NAME_KANA: "[氏名カナ]",
      ZIP: "[郵便番号]",
      ZIP_RAW: "[郵便番号RAW]",
      ADDRESS: "[住所]",
      TEL: "[電話番号]",
      TEL_RAW: "[電話番号RAW]",
    }
  };

  function maskPersonalInfo(text) {
    if (!text) return text;

    const {
      NAME, NAME_KANA, ZIP, ZIP_RAW, ADDRESS, TEL, TEL_RAW
    } =  CONFIG.MASK;

    let result = text;

    // 氏名
    const [last, first] = NAME.split(/\s+/);
    result = result.replace(new RegExp(`${last}\\s?${first}|${last}|${first}`, 'g'),'[氏名隠蔽]');
    // カナ
    result = result.replace(new RegExp(NAME_KANA.replace(/\s+/g, '\\s?'), 'g'), '[氏名カナ隠蔽]');
    // 郵便番号
    result = result.replace(new RegExp(`〒?\\s?(${ZIP}|${ZIP_RAW})`, 'g'), '[郵便番号隠蔽]');
    // 住所  
    result = result.replace(new RegExp(`${ADDRESS}.*`, 'g'), '[住所隠蔽]');
    // 電話番号
    result = result.replace(new RegExp(`${TEL}|${TEL_RAW}`, 'g'), '000-0000-0000');

    return result;
  };

  const getShopData = (shop) => ({
    name: shop?.candidate ?? '',
    note: shop?.raw ?? ''
  });

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
    const lines = [
      `利用日時：${DateUtils.formatDate(date, "yyyy-MM-dd HH:mm")}`,
      `利用店舗：${shopData.note || shopData.name}`,
      `支払方法：${method}`,
      `決済金額：${amount.toLocaleString()}円`,
    ];
    if (url) lines.push(`URL：${url}`);
    if (note) lines.push(`備考: ${note}`);
    return lines.join('\n');
  }

  /**
   * LINE通知を送信します。
   * @param {Array<string>} messages - 通知メッセージリスト（先頭は固定文言）
   */
  const notifyLine = (messages) => {
    if (messages.length <= 1 || CONFIG.DEBUG) return;
    LineUtil.postText(Props.getValue(PKeys.LINE_CHANNEL_TOKEN), Props.getValue(PKeys.LINE_USER_ID), messages.join('\n\n'));
  }

  const getMailAnalyzePrompt = ({ mailBody, shopList }) => {
    const template = Props.getValue(PKeys.MAIL_AI_ANALYZE_PROMPT);
    if (!template) {
      throw new Error(`${PKeys.MAIL_AI_ANALYZE_PROMPT} is not defined`);
    }

    return template
      .replace('{{SHOP_LIST}}', shopList.join(','))
      .replace('{{MAIL_BODY}}', mailBody);
  }

  const analyzeMailBody = (text, shopList) => {
    const prompt = getMailAnalyzePrompt({
      mailBody: text,
      shopList
    });

    return LocalUtils.analyzeByGemini(prompt)
  }

  const processMessage =  (message, setting, shopList, msgList) => {
    const maskedBody = maskPersonalInfo(message.getPlainBody());
    Logger.log(maskedBody);
    const result = analyzeMailBody(maskedBody, shopList);
    Logger.log(result);

    let success = true;

    for (const item of result.items ?? []) {
      const date = item.date ? new Date(item.date) : message.getDate();
      const shopData = getShopData(item.shop);
      const amount = item.amount ?? 0;

      const page = LocalUtils.getCreateSpending({
        title: `${setting.TITLE}自動登録`,
        date,
        amount,
        shop: shopData.name,
        methodPay: setting.METHOD_PAY,
        url: item.url,
        note: item.note || shopData.note,
      });

      const res = CONFIG.DEBUG ? true : LocalUtils.createPage(page);
      const msg = buildMsgList(date, shopData, amount, setting.METHOD_PAY, item.url, item.note);
      Logger.log(msg);

      if (amount === 0) {
        msgList.SKIP.push(msg);
      } else if (res) {
        msgList.SUCCESS.push(msg);
      } else {
        msgList.FAIL.push(msg);
        success = false;
      }
    }

    if (success && !CONFIG.DEBUG) {
      message.unstar();
    }
  };

  return {
    /**
     * メール本文を解析し、家計簿データを自動登録します。
     */
    create: () => {
      const shopList = SpreadsheetApp.getActiveSpreadsheet().getRangeByName('お店').getValues().flat();
      const settings = Props.getMap(PKeys.AUTO_REGIST_SETTING_LIST);
      
      const msgList = {
        'SUCCESS': [ '家計簿の登録に成功しました。' ],
        'FAIL': [ '家計簿の登録に失敗しました。' ],
        'SKIP': [ '家計簿の登録をスキップしました。' ],
      };
      for (const setting of settings) {
        const threads = GmailApp.search(setting.SEARCH_WORD);
        for (const thread of threads) {
          for (const message of thread.getMessages()) {
            if (!message.isStarred()) continue;
            processMessage(message, setting, shopList, msgList);            
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
function CreateHouseholdAccountFromMailAI() {
  MainProcMailAI.create();
}