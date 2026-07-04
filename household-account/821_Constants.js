const Constants = (function () {
  return {
    PROPERTY_FX: {
      TITLE: '月',
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
        LINE_CATEGORY: 7,
        LINE_METHOD_PAY: 8,
        EXCEPT_WORD: 9,
      },
      RNG_NAME: {
        EXCEPT_WORD: '除外ワード',
        LINE_CATEGORY: 'Lineカテゴリ',
        LINE_METHOD_PAY: 'Line支払方法',
      },
    },
  }
})();
