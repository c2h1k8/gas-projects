/**
 * 報告シート（お客様が用意した別ファイル）への工数の書き込み。
 *
 * サマリの「報告シート」列に貼ったファイルの、設定シートで指定したシートへ、
 * 報告対象の案件の工数を「1日×1案件で1行」ずつ入力開始行から書きます。
 * 書くのは設定で指定した列（日付・案件コード・案件名・工数）だけで、他の列には触れません。
 *
 * 前回より件数が減ったときに古い行が残らないよう、前回書いた行数を覚えておき、
 * 「前回と今回の多い方」の行数だけ指定の列を消してから書き直します。
 * 行数を覚えているのは、入力開始行より下にある報告シート側の合計行などを消さないためです。
 */
const ReportExporter = (function () {
  // 読み込み時にサービスを呼ばない（onOpen などのシンプルトリガーでも全ファイルが読み込まれるため）
  const props = () => PropertiesService.getDocumentProperties();
  const tz = () => Session.getScriptTimeZone();
  const now = () => Utilities.formatDate(new Date(), tz(), 'yyyy/MM/dd HH:mm');

  /** 前回書いた行数を覚えておくキー（ファイル・シート・開始行・月ごと） */
  const countKey_ = (fileId, cfg, monthName) => `report:${fileId}:${cfg.sheetName}:${cfg.startRow}:${monthName}`;

  /** 分を報告シートの単位の値にします。 */
  const toReportValue_ = (minutes, unit) => {
    if (unit === Layout.REPORT_UNIT.MINUTES) return minutes;
    if (unit === Layout.REPORT_UNIT.HM) return minutes / 1440;
    return minutes / 60;
  };

  /**
   * 1ヶ月分を報告シートへ書きます。
   * @return 書いた件数
   */
  const exportMonth_ = (ss, monthSheet, fileId, cfg) => {
    const name = monthSheet.getName();
    const projects = MasterSheet.getProjects(ss).filter((p) => p.report);
    const entries = MonthSheet.readEntries(monthSheet, projects);

    const target = SpreadsheetApp.openById(fileId).getSheetByName(cfg.sheetName);
    if (!target) throw new Error(`報告ファイルに「${cfg.sheetName}」シートがありません`);

    const key = countKey_(fileId, cfg, name);
    const prevCount = Number(props().getProperty(key)) || 0;
    const rows = Math.max(prevCount, entries.length);
    const lastRow = cfg.startRow + Math.max(rows, 1) - 1;
    if (target.getMaxRows() < lastRow) target.insertRowsAfter(target.getMaxRows(), lastRow - target.getMaxRows());

    const columns = [
      [cfg.dateCol, (e) => e.date],
      [cfg.codeCol, (e) => e.project.code],
      [cfg.nameCol, (e) => e.project.name],
      [cfg.hoursCol, (e) => toReportValue_(e.minutes, cfg.unit)],
    ].filter(([col]) => col);

    columns.forEach(([col, value]) => {
      if (rows > 0) target.getRange(cfg.startRow, col, rows, 1).clearContent();
      if (entries.length) target.getRange(cfg.startRow, col, entries.length, 1).setValues(entries.map((e) => [value(e)]));
    });
    if (cfg.unit === Layout.REPORT_UNIT.HM && entries.length) {
      target.getRange(cfg.startRow, cfg.hoursCol, entries.length, 1).setNumberFormat(Layout.HM_FORMAT);
    }
    props().setProperty(key, String(entries.length));
    return entries.length;
  };

  /**
   * 指定した月シートを報告シートへ反映し、結果をサマリの「最終反映」列に書きます。
   * 1ヶ月の失敗で他の月を止めないよう、月ごとに結果を返します。
   * @param used ファイル ID → 月。同じ報告シートに2ヶ月分を重ねて書かないための記録で、
   *   進捗ダイアログが1ヶ月ずつ呼ぶときは呼び出しをまたいで引き継ぐ
   * @return [{ name, ok, skipped, count, fileId, message }]
   */
  const run = (ss, monthSheets, used = new Map()) => {
    const cfg = SettingsSheet.readReport(ss);
    return monthSheets.map((sheet) => {
      const name = sheet.getName();
      const fileId = SummarySheet.reportFileId(ss, name);
      if (!fileId) return { name, ok: true, skipped: true, count: 0, fileId: null, message: '報告シートのリンクが無いため対象外' };
      try {
        if (used.has(fileId)) throw new Error(`${used.get(fileId)} と同じ報告ファイルです（月ごとに別のファイルを貼ってください）`);
        used.set(fileId, name);
        const count = exportMonth_(ss, sheet, fileId, cfg);
        SummarySheet.setReportStatus(ss, name, `${now()}　${count}件`);
        return { name, ok: true, skipped: false, count, fileId, message: `${count}件を反映` };
      } catch (e) {
        SummarySheet.setReportStatus(ss, name, `${now()}　エラー: ${e.message}`);
        return { name, ok: false, skipped: false, count: 0, fileId, message: e.message };
      }
    });
  };

  /** 毎晩の反映の対象（当月、月初の数日は前月も）。作成済みの月シートだけ返します。 */
  const targetsForToday = (ss) => {
    const today = new Date();
    const dates = [today];
    if (today.getDate() <= Layout.REPORT_PREV_MONTH_DAYS) dates.push(new Date(today.getFullYear(), today.getMonth() - 1, 1));
    return dates.map((d) => ss.getSheetByName(MonthSheet.nameOf(d))).filter((s) => s);
  };

  return { run, targetsForToday };
})();
