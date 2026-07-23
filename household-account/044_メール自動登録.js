const MainProcMailAI = (() => {
  const CONFIG = {
    DEBUG: false,
    get MASK() {
      return JSON.parse(Props.getValue(PKeys.MAIL_AI_MASK));
    },
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

  const getPayeeData = (payee) => ({
    name: payee?.candidate ?? '',
    note: payee?.raw ?? ''
  });

  /**
   * 通知カード用の明細項目を構築します。
   * @return {{label, amount, sub}}
   */
  const buildItem = (date, payeeData, amount, method, note) => ({
    label: payeeData.note || payeeData.name || '(店舗不明)',
    amount,
    sub: `${method}・${DateUtils.formatDate(date, 'M/d')}${note ? '・' + note : ''}`,
  });

  const getMailAnalyzePrompt = ({ mailBody, payeeList }) => {
    const template = Props.getValue(PKeys.MAIL_AI_ANALYZE_PROMPT);
    if (!template) {
      throw new Error(`${PKeys.MAIL_AI_ANALYZE_PROMPT} is not defined`);
    }

    return template
      .replace('{{PAYEE_LIST}}', payeeList.join(','))
      .replace('{{MAIL_BODY}}', mailBody);
  }

  const analyzeMailBody = (text, payeeList) => {
    const prompt = getMailAnalyzePrompt({
      mailBody: text,
      payeeList
    });

    return GoogleApi.analyzeByGemini(prompt, Props.getValue(PKeys.GEMINI_API_KEY))
  }

  const processMessage =  (message, setting, payeeList, msgList) => {
    const maskedBody = maskPersonalInfo(message.getPlainBody());
    Logger.log(maskedBody);
    const result = analyzeMailBody(maskedBody, payeeList);
    Logger.log(result);

    let success = true;

    for (const item of result.items ?? []) {
      const date = item.date ? new Date(item.date) : message.getDate();
      const payeeData = getPayeeData(item.payee);
      const amount = item.amount ?? 0;

      const res = CONFIG.DEBUG ? true : MoneyApi.registerSpending({
        name: `${setting.TITLE}自動登録`,
        date,
        amount,
        payee: payeeData.name,
        methodPay: setting.METHOD_PAY,
        url: item.url,
        note: item.note || payeeData.note,
      });
      const entry = buildItem(date, payeeData, amount, setting.METHOD_PAY, item.note);

      if (amount === 0) {
        msgList.SKIP.push(entry);
      } else if (res) {
        msgList.SUCCESS.push(entry);
      } else {
        msgList.FAIL.push(entry);
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
      // 支払先候補は money API のマスタから取得（スプレッドシートの名前付き範囲に依存しない）
      const payeeList = (MoneyApi.getMasters().payees ?? []).filter(String);
      const settings = Props.getJson(PKeys.AUTO_REGIST_SETTING_LIST);
      
      const msgList = { SUCCESS: [], FAIL: [], SKIP: [] };
      for (const setting of settings) {
        const threads = GmailApp.search(setting.SEARCH_WORD);
        for (const thread of threads) {
          for (const message of thread.getMessages()) {
            if (!message.isStarred()) continue;
            processMessage(message, setting, payeeList, msgList);
          }
        }
      }

      const count = msgList.SUCCESS.length + msgList.FAIL.length + msgList.SKIP.length;
      if (count && !CONFIG.DEBUG) {
        LocalUtils.postFlex('メールから登録', NotifyCards.mailResult({
          success: msgList.SUCCESS,
          skip: msgList.SKIP,
          fail: msgList.FAIL,
        }));
      }
    }
  };
})();

/**
 * メールから家計簿登録
 */
function CreateHouseholdAccountFromMailAI() {
  MainProcMailAI.create();
}