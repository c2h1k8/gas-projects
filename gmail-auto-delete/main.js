const MainProc = (() => {
  const SHEET = {
    NAME: '設定',
    ROW_NO: {
      HEAD: 3,
      DATA: 4,
    },
    COL_NO: {
      CHK: 2,
    },
    COL_IDX: {
      CHK: 0,
    }
  }
  const OPTIONS = {
    TITLE: {
      IDX: 1,
    },
    DELAY_DAYS: {
      IDX: 3,
      IDX_EXCLUDE: 2,
    },
    FROM: {
      IDX: 5,
      IDX_EXCLUDE: 4,
    },
    TO: {
      IDX: 7,
      IDX_EXCLUDE: 6,
    },
    LABEL: {
      IDX: 9,
      IDX_EXCLUDE: 8,
    },
    READ: {
      IDX: 10,
      EXCLUDE_VALUE: '未読',
    },
    STAR: {
      IDX: 11,
      EXCLUDE_VALUE: 'なし',
    },
    INBOX: {
      IDX: 12,
      EXCLUDE_VALUE: 'アーカイブ',
    }
  }
  const OPERATOR_TYPE = {
    DELAY_DAYS: {
      OPERATOR: 'older_than:', 
      ENCLOSED: '',
    },
    FROM: {
      OPERATOR: 'from:', 
      ENCLOSED: '"',
    },
    TO: {
      OPERATOR: 'to:', 
      ENCLOSED: '"',
    },
    STAR: {
      OPERATOR: 'is:starred', 
      ENCLOSED: '',
    },
    READ: {
      OPERATOR: 'is:read', 
      ENCLOSED: '',
    },
    INBOX: {
      OPERATOR: 'in:inbox', 
      ENCLOSED: '',
    },
    LABEL: {
      OPERATOR: 'label:', 
      ENCLOSED: '',
    }
  }
  const getQuery = (option) => {
    let query = '';
    for (const key in OPERATOR_TYPE) {
      const value = option[key];
      if (!value) continue;
      const exclude = value.IS_EXCLUDE ? '-' : '';
      const operatorType = OPERATOR_TYPE[key];
      const searchWord = value.VALUE ? ''.concat(operatorType.ENCLOSED, value.VALUE, operatorType.ENCLOSED) : '';
      query = query.concat(exclude, operatorType.OPERATOR, searchWord, ' ');
    }
    return query;
  }
  const getQueryOptions = () => {
    const sheet = SpreadsheetApp.getActiveSheet();
    const endRow = SpreadUtils.getEndRow(sheet, SHEET.COL_NO.CHK);
    const endCol = SpreadUtils.getEndCol(sheet, SHEET.ROW_NO.HEAD);
    const queryOptions = [];
    if (SHEET.ROW_NO.HEAD === endRow) return queryOptions;
    const datas = sheet.getRange(SHEET.ROW_NO.DATA, SHEET.COL_NO.CHK, endRow - SHEET.ROW_NO.HEAD, endCol - SHEET.COL_NO.CHK + 1).getValues();
    for (const data of datas) {
      if (!data[SHEET.COL_IDX.CHK]) continue;
      const json = {};
      for (const key in OPTIONS) {
        const option = OPTIONS[key];
        const value = data[option.IDX];
        if (!value) continue;
        if (option.IDX_EXCLUDE) {
          // チェックボックスによる除外設定
          json[key] = {
            IS_EXCLUDE: data[option.IDX_EXCLUDE],
            VALUE: value,
          };
        } else if (option.EXCLUDE_VALUE) {
          // 入力値による除外設定
          json[key] = {
            IS_EXCLUDE: option.EXCLUDE_VALUE === value,
          };
        } else {
          // 除外設定なし
          json[key] = value;
        }
      }
      queryOptions.push(json);
    }
    return queryOptions;
  }
  return {
    delete: () => {
      const queryOptions = getQueryOptions();
      for (const queryOption of queryOptions) {
        const query = getQuery(queryOption);
        const threads = GmailApp.search(query);
        const trashMails = [];
        for (const thread of threads) {
          for (const msg of thread.getMessages()) {
            trashMails.push(`${Utilities.formatDate(msg.getDate(), 'JST', 'yyyy-MM-dd HH:mm')}: ${msg.getSubject()}`);
            if (Props.getValue(PKeys.DEBUG_MODE) !== '1') {
              msg.moveToTrash();
            }
          }
        }
        const cnt = trashMails.length;
        if (cnt === 0) continue;
        Logger.log(`${queryOption.TITLE}: ${cnt}件 [${query}]`);
        for (const trashMail of trashMails) {
          Logger.log(trashMail);
        }
      }
    }
  }
})();

const AutoDeleteMail = () => {
  MainProc.delete()
}