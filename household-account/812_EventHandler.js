const MainProcEventHandler = (function () {
  // プロパティ
  const props = PropertiesService.getScriptProperties().getProperties();
  const isTargetCell = (e, row, column) => {
    if (e.range.getRow() !== row) {
      return false;
    }
    if (e.range.getColumn() !== column) {
      return false;
    }
    return true;
  }
  return {
    changeMaster: (e) => {
      // 対象セル確認
      if (!isTargetCell(e, Constants.SHEET_MASTER.ROW.CHK, Constants.SHEET_MASTER.COL.CHK_TARGET)) return;
      const from = e.oldValue;
      const to = e.value; 
      Logger.log(`from: ${from}, to: ${to}`);
      // セル変更
      const sheet = e.source.getActiveSheet();
      sheet.getRange(
        Constants.SHEET_MASTER.ROW.CHK,
        Constants.SHEET_MASTER.COL.CHK_TARGET,
        1,
        SpreadUtils.getEndCol(sheet, Constants.SHEET_MASTER.ROW.CHK)).setValue(to);
    },
  };
})();

const onEdit = (e) => {
  switch (e.source.getSheetName()) {
    case Constants.SHEET_MASTER.NAME:
      MainProcEventHandler.changeMaster(e);
      break;
  }
}
