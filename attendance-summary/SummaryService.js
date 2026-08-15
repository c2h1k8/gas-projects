/**
 * 勤務表を集めてサマリシートへ反映する本体。
 *
 * 反映のたびに全ての勤務表を開くと月数ぶん時間がかかるため、
 * シートに持たせた「勤務表 最終更新」とDrive側の最終更新日時を突き合わせ、
 * 変わったファイルだけを開きます（メタデータの取得は軽い）。
 *
 * ただし当月と未来月は毎回読み直します。勤務表は未来の営業日に既定の時刻が
 * 入っているため、ファイルが編集されなくても日付が進むだけで
 * 「当日までの実績」の範囲が変わるからです。
 *
 * 契約由来の値（単価・精算幅・還元率）は、勤務表を読み直したかどうかに関係なく
 * 毎回すべての行へ入れ直します。契約シートを直したら過去の月も計算し直したいためです。
 */
const SummaryService = (function () {
  const COL = SheetLayout.COL;
  const START = SheetLayout.DATA_START_ROW;
  const DAYS = SheetLayout.MAX_DAYS;

  /** サマリシートを取得します（無ければ初期化して作る）。 */
  const getSheet_ = (ss) => ss.getSheetByName(SheetLayout.SUMMARY_SHEET) || SheetLayout.setup(ss);

  /**
   * サマリシートの既存行を読み出します。
   * 再取得しない月は、集計値・日別の値と背景色をそのまま書き戻すために持ちます。
   */
  const readExisting_ = (sheet) => {
    const last = sheet.getLastRow();
    if (last < START) return [];
    const n = last - START + 1;
    const values = sheet.getRange(START, 1, n, SheetLayout.TOTAL_COLS).getValues();
    const bgs = sheet.getRange(START, COL.DAY_START, n, DAYS).getBackgrounds();

    const rows = [];
    values.forEach((v, i) => {
      // 表示は '2026/08' だが、キーとして扱うのは 'yyyyMM'（勤務表側と揃えて比較・並べ替えに使う）
      const ym = String(v[COL.YM - 1] || '').replace(/[^0-9]/g, '').slice(0, 6);
      if (ym.length !== 6) return;
      rows.push({
        ym,
        auto: {
          workDays: v[COL.WORK_DAYS - 1],
          paid: v[COL.PAID - 1],
          absent: v[COL.ABSENT - 1],
          daikyu: v[COL.DAIKYU - 1],
          holidayWork: v[COL.HOLIDAY_WORK - 1],
          workHours: v[COL.WORK_H - 1],
          actualHours: v[COL.ACTUAL_H - 1],
        },
        meta: {
          created: v[COL.FILE_CREATED - 1],
          updated: v[COL.FILE_UPDATED - 1],
          importedAt: v[COL.IMPORTED_AT - 1],
          fileId: String(v[COL.FILE_ID - 1] || ''),
        },
        dayValues: v.slice(COL.DAY_START - 1, COL.DAY_START - 1 + DAYS),
        dayColors: bgs[i],
      });
    });
    return rows;
  };

  /** 読み取った勤務表から書き込み用の行を組み立てます。 */
  const buildRow_ = (data, file) => ({
    ym: data.ym,
    auto: {
      workDays: data.workDays,
      paid: data.paid,
      absent: data.absent,
      daikyu: data.daikyu,
      holidayWork: data.holidayWork,
      // 精算の元になる時間。見込みがあれば見込み、無ければ実績
      workHours: data.forecastHours !== null ? data.forecastHours
        : ((data.actualHours === 0 && data.workDays === 0) ? '' : data.actualHours),
      // 実績がまだ無い未来月は0ではなく空にする（0時間と紛らわしいため）
      actualHours: (data.actualHours === 0 && data.workDays === 0) ? '' : data.actualHours,
    },
    meta: {
      created: file.created,
      updated: file.updated,
      importedAt: new Date(),
      fileId: file.id,
    },
    dayValues: data.days.map((d) => (d.hours === null ? '' : d.hours)),
    dayColors: data.days.map((d) => Timesheet.dayColor(d)),
  });

  /** 月の行1つぶんのセルを組み立てます。 */
  const monthCells_ = (row, r) => {
    const arr = new Array(SheetLayout.TOTAL_COLS).fill('');
    arr[COL.YM - 1] = row.ym.length === 6 ? `${row.ym.slice(0, 4)}/${row.ym.slice(4)}` : row.ym;
    arr[COL.WORK_DAYS - 1] = row.auto.workDays;
    arr[COL.PAID - 1] = row.auto.paid;
    arr[COL.ABSENT - 1] = row.auto.absent;
    arr[COL.DAIKYU - 1] = row.auto.daikyu;
    arr[COL.HOLIDAY_WORK - 1] = row.auto.holidayWork;
    arr[COL.WORK_H - 1] = row.auto.workHours;
    arr[COL.ACTUAL_H - 1] = row.auto.actualHours;

    const c = row.contract;
    arr[COL.CONTRACT - 1] = c ? c.name : '';
    arr[COL.MONTHLY - 1] = c ? c.monthly : '';
    arr[COL.LOWER - 1] = c ? c.lower : '';
    arr[COL.UPPER - 1] = c ? c.upper : '';
    arr[COL.BASE_H - 1] = c ? c.baseHours : '';
    arr[COL.ROUND_ADJ - 1] = c ? c.roundingAdj : '';
    arr[COL.UNIT_ADJ - 1] = c ? c.unitAdj : '';
    arr[COL.RATE - 1] = c ? c.rate : '';
    arr[COL.ROUND_PAY - 1] = c ? c.roundingPay : '';
    arr[COL.UNIT_PAY - 1] = c ? c.unitPay : '';

    // 金額まわりは数式で持たせる（計算根拠をシート上で追えるようにするため）
    const f = SheetLayout.formulasFor(r);
    Object.keys(f).forEach((col) => { arr[Number(col) - 1] = f[col]; });

    arr[COL.FILE_CREATED - 1] = row.meta.created || '';
    arr[COL.FILE_UPDATED - 1] = row.meta.updated || '';
    arr[COL.IMPORTED_AT - 1] = row.meta.importedAt || '';
    arr[COL.FILE_ID - 1] = row.meta.fileId || '';

    for (let d = 0; d < DAYS; d++) arr[COL.DAY_START - 1 + d] = row.dayValues[d] === undefined ? '' : row.dayValues[d];
    return arr;
  };

  /**
   * 行の配列をシートへ書き戻します（並び順・書式・色もここで揃える）。
   *
   * 年ごとに小計行を挟みます。月が積み上がると縦に長くなるため、
   * 年単位で区切って合計を先に見せ、その年の月は折りたためるようにしています。
   */
  const writeRows_ = (sheet, rows) => {
    const values = [];
    const colors = [];
    const links = [];        // 勤務表へのリンク（値として埋めるので数式にはしない）
    const yearRows = [];     // 年計行の行番号
    const forecastRows = []; // 見込みで計算している月の行番号
    const groups = [];       // 折りたたむ月の範囲
    const nowYm = Timesheet.ym(new Date());
    const blankDays = new Array(DAYS).fill('#ffffff');

    // rowsは年月の降順。同じ年が続く区切りで年計行を挟む
    let i = 0;
    while (i < rows.length) {
      const year = rows[i].ym.slice(0, 4);
      let j = i;
      while (j < rows.length && rows[j].ym.slice(0, 4) === year) j++;

      const headerRow = START + values.length;
      values.push(new Array(SheetLayout.TOTAL_COLS).fill('')); // 中身は月の行番号が決まってから入れる
      colors.push(blankDays);
      links.push(SheetLayout.linkValues(''));
      yearRows.push(headerRow);

      const from = START + values.length;
      for (let k = i; k < j; k++) {
        // 当月・未来月は稼働時間に見込みが入る。確定値と見分けられるよう控えておく
        if (rows[k].ym >= nowYm) forecastRows.push(START + values.length);
        values.push(monthCells_(rows[k], START + values.length));
        colors.push(rows[k].dayColors);
        links.push(SheetLayout.linkValues(rows[k].meta.fileId));
      }
      const to = START + values.length - 1;

      const yv = SheetLayout.yearRowFor(year, from, to);
      Object.keys(yv).forEach((col) => { values[headerRow - START][Number(col) - 1] = yv[col]; });
      groups.push({ from, count: to - from + 1 });

      i = j;
    }

    // 前回の書式を一度落とす。
    // 行の位置が変わると、古い塗り（年計行のグレーなど）が別の行に残って見えるため。
    // 必要な書式はこの後すべて当て直すので、消してから組み立てる。
    const formatted = sheet.getMaxRows() - START + 1;
    if (formatted > 0) sheet.getRange(START, 1, formatted, SheetLayout.TOTAL_COLS).clearFormat();

    if (values.length) {
      const need = START + values.length - 1;
      if (sheet.getMaxRows() < need) sheet.insertRowsAfter(sheet.getMaxRows(), need - sheet.getMaxRows());

      // 書式を先にあてる。年月は '2026/08' が日付に変換されてしまうため、
      // 文字列書式にしてから値を入れる必要がある。
      SheetLayout.applyFormats(sheet, values.length);
      // 行を少し高くして余白をとる（詰まって見えるのを防ぐ）
      sheet.setRowHeights(START, values.length, SheetLayout.ROW_HEIGHT);
      sheet.getRange(START, 1, values.length, SheetLayout.TOTAL_COLS).setValues(values);
      sheet.getRange(START, COL.DAY_START, values.length, DAYS).setBackgrounds(colors);
      sheet.getRange(START, COL.LINK_OPEN, values.length, links[0].length).setRichTextValues(links);
      SheetLayout.styleYearRows(sheet, yearRows);
      SheetLayout.styleForecastCells(sheet, forecastRows);
      // 残業の警告色は、月の行と年計行で当て方を変えるので行の並びが決まってから
      SheetLayout.applyOvertimeAlert(sheet, groups, yearRows);
    }

    // 表の下に空行を残さない（どこまでが表か分かるようにする）
    SheetLayout.trim(sheet, START + values.length - 1, SheetLayout.TOTAL_COLS);
    SheetLayout.groupRows(sheet, groups);
  };

  /**
   * サマリを更新します。
   * @param full trueなら索引を作り直し、全ての勤務表を読み直す
   * @param onProgress 進捗を知らせる関数（任意）。メニューからの実行でだけ渡す。
   *   トリガからの実行では画面が無いので渡さない。
   * @return { months, read, skipped, kept, noContract, scanned } 件数
   */
  const refresh = (full = false, onProgress) => {
    const report = (msg) => { if (onProgress) onProgress(msg); };
    report('設定を読み込んでいます…');
    const cfg = Config.load();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getSheet_(ss);

    const existing = readExisting_(sheet);
    const byYm = {};
    existing.forEach((r) => { byYm[r.ym] = r; });

    // フォルダの走査は、索引に無い月があるときだけ行う
    let index = FileIndex.load();
    let metaById = {};
    let dataById = {};
    let scanned = false;
    if (FileIndex.needsScan(cfg, index, full)) {
      report('勤務表フォルダを調べています…');
      const r = FileIndex.scan(cfg, ss.getId());
      index = r.index;
      metaById = r.metaById;
      dataById = r.dataById;
      scanned = true;
    }

    const nowYm = Timesheet.ym(new Date());
    // 進捗を古い月から順に見せたいので並べ替える
    const months = Object.keys(index.months).sort();
    const result = { months: months.length, read: 0, skipped: 0, kept: 0, noContract: 0, scanned };
    const merged = {};

    months.forEach((ym, idx) => {
      const label = `${ym.slice(0, 4)}/${ym.slice(4)}`;
      report(`${label} を確認しています…（${idx + 1}/${months.length}）`);
      const entry = index.months[ym];
      const prev = byYm[ym];
      // 当月・未来月は日付が進むだけで実績範囲が変わるため、更新が無くても読み直す
      const isOpen = ym >= nowYm;
      let needRead = full || !prev || isOpen;

      // 走査した回だけは、過去月も最終更新日時を見て編集を拾う。
      // 走査しない回はメタデータを取りに行かないぶん、過去月の編集は次の走査まで反映されない。
      let meta = metaById[entry.id] || null;
      if (!needRead && meta) {
        const prevUpdated = prev.meta.updated instanceof Date ? prev.meta.updated.getTime() : null;
        needRead = prevUpdated === null || prevUpdated !== meta.updated.getTime();
      }

      if (!needRead) {
        prev.meta.created = Timesheet.toDate(entry.created) || prev.meta.created;
        merged[ym] = prev;
        result.skipped++;
        return;
      }

      // 走査していない回は、読む月のぶんだけメタデータを取る
      if (!meta) meta = Timesheet.fileMeta(entry.id);
      if (!meta) {
        // 索引にあるがもう開けないファイル。次の走査で索引から落ちる
        if (prev) { merged[ym] = prev; result.kept++; }
        return;
      }

      report(`${label} の勤務表を読み込んでいます…（${idx + 1}/${months.length}）`);
      const data = dataById[entry.id] || Timesheet.readMonth(entry.id, cfg);
      if (!data) {
        if (prev) { merged[ym] = prev; result.kept++; }
        return;
      }
      merged[data.ym] = buildRow_(data, meta);
      result.read++;
    });

    // 索引に無い月も、集計済みの内容が消えないよう残す
    existing.forEach((r) => {
      if (merged[r.ym]) return;
      merged[r.ym] = r;
      result.kept++;
    });

    let rows = Object.keys(merged).map((k) => merged[k]);
    if (cfg.fromYm) rows = rows.filter((r) => r.ym >= cfg.fromYm);
    rows.sort((a, b) => (a.ym < b.ym ? 1 : a.ym > b.ym ? -1 : 0)); // 新しい月が上

    // 契約は毎回引き直す（契約シートを直したら全ての月に反映させたいため）
    report('契約を反映しています…');
    const contracts = Contracts.load();
    rows.forEach((r) => {
      r.contract = Contracts.find(contracts, r.ym);
      if (!r.contract) result.noContract++;
    });

    report(`シートへ書き込んでいます…（${rows.length}ヶ月）`);
    writeRows_(sheet, rows);
    Logger.log('[SummaryService] 索引%sヶ月 / 走査%s / 読込%s / スキップ%s / 据置%s / 契約なし%s → %s行',
      result.months, scanned ? 'あり' : 'なし', result.read, result.skipped, result.kept, result.noContract, rows.length);
    return result;
  };

  return { refresh };
})();
