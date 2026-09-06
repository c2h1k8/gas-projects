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
      // 収入カテゴリ(E)は支出カテゴリ(D)の隣。money 側の M_CODE_MASTER が
      // KIND='EXPENSE_CATEGORY' / 'INCOME_CATEGORY' と軸を分けて持つのに合わせる
      // （収入は未カテゴリだと money 側で確定できないので、選択肢がここに要る）。
      COL: {
        CHK_TARGET: 1,
        TITLE_SPENDING: 2,
        TITLE_INCOME: 3,
        EXPENSE_CATEGORY: 4,
        INCOME_CATEGORY: 5,
        PAYEE: 6,
        METHOD_PAY: 7,
        LINE_CATEGORY: 8,
        LINE_METHOD_PAY: 9,
        EXCEPT_WORD: 10,
      },
      RNG_NAME: {
        EXCEPT_WORD: '除外ワード',
        LINE_CATEGORY: 'Lineカテゴリ',
        LINE_METHOD_PAY: 'Line支払方法',
      },
    },
  }
})();
