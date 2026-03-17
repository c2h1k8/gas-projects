const LocalUtils = (function () {
  return {
    /**
     * 支出登録用のデータを取得する
     * @param titile タイトル
     * @param category, カテゴリ
     * @param date 日付
     * @param amount 金額
     * @param shop お店
     * @param methodPay 支払方法
     * @param url URL
     * @param note 備考
     * @param icon アイコン
     * @return ページオブジェクト
     */
    getCreateSpending: ({ title, category, date, amount, shop, methodPay, url, note, icon, expenseRatio }) => {
      const propItem = new Map();
      propItem.set(Constants.PROPERTY_SPENDING.TITLE, new NotionPropTitle(title));
      propItem.set(Constants.PROPERTY_SPENDING.CATEGORY, new NotionPropSelect(category));
      propItem.set(Constants.PROPERTY_SPENDING.DATE, new NotionPropDate(date, false));
      propItem.set(Constants.PROPERTY_SPENDING.AMOUNT, new NotionPropNumber(amount));
      propItem.set(Constants.PROPERTY_SPENDING.SHOP, new NotionPropSelect(shop));
      propItem.set(Constants.PROPERTY_SPENDING.METHOD_PAY, new NotionPropSelect(methodPay));
      propItem.set(Constants.PROPERTY_SPENDING.URL, new NotionPropUrl(url));
      propItem.set(Constants.PROPERTY_SPENDING.NOTE, new NotionPropText(note));
      propItem.set(Constants.PROPERTY_SPENDING.EXPENSE_RATIO, new NotionPropNumber(expenseRatio));
      propItem.set(Constants.PROPERTY_SPENDING.DB_UPDATE_CHECKED, new NotionPropCheckBox(false));
      return new NotionPage(Props.getValue(PKeys.DATA_SOURCE_ID_SPENDING), propItem, icon);
    },
    /**
     * 収入登録用のデータを取得する
     * @param titile タイトル
     * @param date 日付
     * @param amount 金額
     * @param icon アイコン
     * @return ページオブジェクト
     */
    getCreateIncome: ({ title, date, amount, icon }) => {
      const propItem = new Map();
      propItem.set(Constants.PROPERTY_INCOME.TITLE, new NotionPropTitle(title));
      propItem.set(Constants.PROPERTY_INCOME.DATE, new NotionPropDate(date, false));
      propItem.set(Constants.PROPERTY_INCOME.AMOUNT, new NotionPropNumber(amount));
      propItem.set(Constants.PROPERTY_INCOME.DB_UPDATE_CHECKED, new NotionPropCheckBox(false));
      return new NotionPage(Props.getValue(PKeys.DATA_SOURCE_ID_INCOME), propItem, icon);
    },
    postText: (message, emojis = []) => {
      LineUtil.postText(Props.getValue(PKeys.LINE_CHANNEL_TOKEN), Props.getValue(PKeys.LINE_USER_ID), message, emojis);
    },
  };
})();
