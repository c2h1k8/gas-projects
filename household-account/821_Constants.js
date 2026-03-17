const Constants = (function () {
  return {
    PROPERTY_ID: 'id',
    PROPERTY_SPENDING: {
      TITLE: '支出',
      CATEGORY: '大カテゴリ',
      DATE: '日付',
      AMOUNT: '金額',
      SHOP: 'お店',
      METHOD_PAY: '支払方法',
      URL: 'URL',
      NOTE: '備考',
      EXPENSE_RATIO: '経費率',
      CHECKED: '確認',
      DB_UPDATE_CHECKED: 'DB登録',
    },
    PROPERTY_INCOME: {
      TITLE: '収入',
      DATE: '日付',
      AMOUNT: '金額',
      CHECKED: '確認',
      DB_UPDATE_CHECKED: 'DB登録',
    },
    PROPERTY_CATEGORY: {
      TITLE: '大カテゴリ',
    },
    PROPERTY_FX: {
      TITLE: '月',
    },
    PROPERTY_ANNUAL_STOCK: {
      TITLE: '名前',
    },
    PROPERTY_STOCK_MANAGEMENT: {
      TITLE: '商品名',
      CONFIRM_DATE: '確認日',
      STOCK_CNT: '在庫数',
      DISCOUNT: '割引率',
      PRICE: '価格',
      CAPACITY: '容量',
      URL: 'URL',
      STOCK_TYPE: '商品',
    },
    PROPERTY_TODO: {
      TASK: 'タスク',
      LIMIT: '期日',
      TAG: 'タグ',
      COMPLETE: '完了',
    },
    SHEET_NAME_REGIST: '家計簿登録',
    SHEET_MASTER: {
      NAME: 'マスタ',
      ROW: {
        CHK: 1,
        HEADER: 2,
        DATA: 3,
      },
      COL: {
        CHK_TARGET: 1,
        TITLE_SPENDING: 2,
        TITLE_INCOME: 3,
        CATEGORY: 4,
        SHOP: 5,
        METHOD_PAY: 6,
        PRODUCT: 7,
      },
      RNG_NAME: {
        EXCEPT_WORD: '除外ワード',
      },
    },
  }
})();
