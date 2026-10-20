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
   * 今のシートの見出しから、列の名前 → 列の位置（0始まり）を引けるようにします。
   *
   * 列を足したあと最初の更新では、シートはまだ前の並びのままです。
   * 列番号で読むとずれた値を拾ってしまうので、見出しの名前で探します。
   * 2段目に列名、年月・契約・日別は1段目に列名が入っています。
   */
  const columnNames_ = (sheet) => {
    const cols = sheet.getMaxColumns();
    const rows = Math.min(SheetLayout.HEADER_ROWS, sheet.getMaxRows());
    if (cols < 1 || rows < 1) return [];
    const head = sheet.getRange(1, 1, rows, cols).getValues();
    return head[0].map((_, c) => String((head[rows - 1] && head[rows - 1][c]) || head[0][c] || '').trim());
  };

  /** シートの列の並びが今のレイアウトと同じかを返します（違えば初期化と全期間の読み直しが要る）。 */
  const layoutMatches_ = (sheet) => {
    const names = columnNames_(sheet);
    return SheetLayout.HEADERS.every((h, i) => names[i] === h);
  };

  /**
   * サマリシートの既存行を読み出します。
   * 再取得しない月は、集計値・日別の値と背景色をそのまま書き戻すために持ちます。
   */
  const readExisting_ = (sheet) => {
    const last = sheet.getLastRow();
    if (last < START) return [];
    const n = last - START + 1;
    const names = columnNames_(sheet);
    const values = sheet.getRange(START, 1, n, names.length).getValues();
    const bgs = sheet.getRange(START, 1, n, names.length).getBackgrounds();

    // 列の名前で位置を引く。見つからない列（前の並びに無かった列）は空として読む
    const pos = {};
    names.forEach((name, i) => { if (name && !(name in pos)) pos[name] = i; });
    const at = (arr, col) => {
      const i = pos[SheetLayout.HEADERS[col - 1]];
      return i === undefined ? '' : arr[i];
    };
    const days = (arr) => Array.from({ length: DAYS }, (_, d) => at(arr, COL.DAY_START + d));

    const rows = [];
    values.forEach((v, i) => {
      // 表示は '2026/08' だが、キーとして扱うのは 'yyyyMM'（勤務表側と揃えて比較・並べ替えに使う）
      const ym = String(at(v, COL.YM) || '').replace(/[^0-9]/g, '').slice(0, 6);
      if (ym.length !== 6) return;
      rows.push({
        ym,
        auto: {
          workDays: at(v, COL.WORK_DAYS),
          paid: at(v, COL.PAID),
          absent: at(v, COL.ABSENT),
          daikyu: at(v, COL.DAIKYU),
          holidayWork: at(v, COL.HOLIDAY_WORK),
          workHours: at(v, COL.WORK_H),
          actualHours: at(v, COL.ACTUAL_H),
          rawHours: at(v, COL.RAW_H),
        },
        meta: {
          created: at(v, COL.FILE_CREATED),
          updated: at(v, COL.FILE_UPDATED),
          importedAt: at(v, COL.IMPORTED_AT),
          fileId: String(at(v, COL.FILE_ID) || ''),
        },
        dayValues: days(v),
        dayColors: days(bgs[i]).map((c) => c || '#ffffff'),
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
      // 精算の元になる時間。見込みがあれば見込み、無ければ実績（設定により有給・代休を含む）
      workHours: data.forecastHours !== null ? data.forecastHours
        : ((data.settleHours === 0 && data.workDays === 0) ? '' : data.settleHours),
      // 残業・日平均の元になる、実際に働いた時間（有給・代休を含まない）。
      // 実績がまだ無い未来月は0ではなく空にする（0時間と紛らわしいため）
      actualHours: (data.actualHours === 0 && data.workDays === 0) ? '' : data.actualHours,
      // 会社の残業の元になる、丸める前の働いた時間
      rawHours: (data.rawHours === 0 && data.workDays === 0) ? '' : data.rawHours,
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
    arr[COL.RAW_H - 1] = row.auto.rawHours;

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
    const monthRows = [];    // [{ ym, row, yearOldest }] 36協定の列の数式を後で入れるため
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
        monthRows.push({ ym: rows[k].ym, row: START + values.length });
        values.push(monthCells_(rows[k], START + values.length));
        colors.push(rows[k].dayColors);
        links.push(SheetLayout.linkValues(rows[k].meta.fileId));
      }
      const to = START + values.length - 1;
      monthRows.forEach((m) => { if (m.yearOldest === undefined) m.yearOldest = to; });

      const yv = SheetLayout.yearRowFor(year, from, to);
      Object.keys(yv).forEach((col) => { values[headerRow - START][Number(col) - 1] = yv[col]; });
      groups.push({ from, count: to - from + 1 });

      i = j;
    }

    // 36協定の列は前の月（前の年のこともある）の行を参照するので、全ての行番号が決まってから入れる
    const rowByYm = {};
    monthRows.forEach((m) => { rowByYm[m.ym] = m.row; });
    monthRows.forEach((m) => {
      const prevRows = [];
      for (let n = 1; n < 6; n++) {
        const row = rowByYm[shiftYm_(m.ym, -n)];
        if (!row) break; // 月が抜けたら、そこより前は連続した期間にならない
        prevRows.push(row);
      }
      const f = SheetLayout.overtimeLimitFormulas(m.row, prevRows, m.yearOldest);
      Object.keys(f).forEach((col) => { values[m.row - START][Number(col) - 1] = f[col]; });
    });

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
   * 手順の間で月ごとの途中結果を置く場所。
   *   - トリガからの実行（1回で全部やる）はメモリ
   *   - 進捗ダイアログからの実行（手順ごとに別の実行になる）はスクリプトキャッシュ
   * キャッシュは文字列しか置けないので、日付は { $date: ミリ秒 } にして戻す。
   */
  const memoryStore_ = () => {
    const map = new Map();
    return { put: (key, value) => map.set(key, value), get: (key) => map.get(key) };
  };
  const cacheStore_ = (runId) => {
    const cache = CacheService.getScriptCache();
    const key = (k) => `summary-refresh:${runId}:${k}`;
    const TTL = 6 * 60 * 60; // 最長の6時間
    return {
      put: (k, value) => cache.put(key(k), JSON.stringify(value, function (name, v) {
        const raw = this[name];
        return raw instanceof Date ? { $date: raw.getTime() } : v;
      }), TTL),
      get: (k) => {
        const raw = cache.get(key(k));
        return raw ? JSON.parse(raw, (name, v) => (v && typeof v === 'object' && '$date' in v ? new Date(v.$date) : v)) : null;
      },
    };
  };

  /** 'yyyyMM' を n ヶ月ずらします（負なら過去）。 */
  const shiftYm_ = (ym, n) => {
    const d = new Date(Number(ym.slice(0, 4)), Number(ym.slice(4)) - 1 + n, 1);
    return Timesheet.ym(d);
  };

  /** 'yyyyMM' → '2026/08' */
  const label_ = (ym) => `${ym.slice(0, 4)}/${ym.slice(4)}`;

  /**
   * 1. 準備: 索引を確かめ（必要ならフォルダを走査し）、どの月を読み直すかを決めます。
   * 走査で開いたファイルはその場で行にして store に置き、読み直す月から外します（同じファイルを二度開かない）。
   * @return plan { scanned, months, toRead: [{ ym, id }], skipYms: [ym] }（JSON にできる値だけ）
   */
  const prepare = (full, store) => {
    const cfg = Config.load();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getSheet_(ss);
    const byYm = {};
    readExisting_(sheet).forEach((r) => { byYm[r.ym] = r; });
    // 列の並びが変わった（アップデートで列が増えた）ときは、計算の定義も変わっている
    // 可能性があるので、全ての月を読み直す。
    // 勤務表の読み取りに効く設定（有給の扱い・丸め単位など）が前回から変わったときも同じ。
    // 差分の更新は過去月を読み直さないので、そのままだと設定の変更が過去月に効かないため
    const signature = Config.readSignature(cfg);
    if (!layoutMatches_(sheet) || Props.getValue(PKeys.LAST_READ_CONFIG) !== signature) full = true;

    // フォルダの走査は、索引に無い月があるときだけ行う
    let index = FileIndex.load();
    let metaById = {};
    let dataById = {};
    let scanned = false;
    if (FileIndex.needsScan(cfg, index, full)) {
      const r = FileIndex.scan(cfg, ss.getId());
      index = r.index;
      metaById = r.metaById;
      dataById = r.dataById;
      scanned = true;
    }

    const nowYm = Timesheet.ym(new Date());
    const months = Object.keys(index.months).sort(); // 古い月から順に読む
    const toRead = [];
    const skipYms = [];
    months.forEach((ym) => {
      const entry = index.months[ym];
      const prev = byYm[ym];
      // 当月・未来月は日付が進むだけで実績範囲が変わるため、更新が無くても読み直す
      let needRead = full || !prev || ym >= nowYm;

      // 走査した回だけは、過去月も最終更新日時を見て編集を拾う。
      // 走査しない回はメタデータを取りに行かないぶん、過去月の編集は次の走査まで反映されない。
      const meta = metaById[entry.id] || null;
      if (!needRead && meta) {
        const prevUpdated = prev.meta.updated instanceof Date ? prev.meta.updated.getTime() : null;
        needRead = prevUpdated === null || prevUpdated !== meta.updated.getTime();
      }
      if (!needRead) {
        skipYms.push(ym);
        return;
      }
      // 走査で開いた月は、もう読んである
      if (meta && dataById[entry.id]) {
        store.put(`row:${ym}`, { status: 'read', row: buildRow_(dataById[entry.id], meta) });
        return;
      }
      if (meta) store.put(`meta:${ym}`, meta);
      toRead.push({ ym, id: entry.id });
    });
    return { scanned, months: months.length, toRead, skipYms, signature };
  };

  /**
   * 2. 1ヶ月分の勤務表を読み、行にして store に置きます。
   * @return 'read'（読んだ）/ 'missing'（開けない・勤務表として読めない。前回の行があればそのまま残す）
   */
  const readOne = (item, store) => {
    const cfg = Config.load();
    // 走査していない回は、読む月のぶんだけメタデータを取る
    const meta = store.get(`meta:${item.ym}`) || Timesheet.fileMeta(item.id);
    const data = meta ? Timesheet.readMonth(item.id, cfg) : null;
    if (!data) {
      store.put(`row:${item.ym}`, { status: 'missing' });
      return 'missing';
    }
    store.put(`row:${item.ym}`, { status: 'read', row: buildRow_(data, meta) });
    return 'read';
  };

  /**
   * 3. 読んだ月と読まなかった月を合わせ、契約を引き直してシートへ書きます。
   * @return { months, read, skipped, kept, noContract, scanned } 件数
   */
  const commit = (plan, store) => {
    const cfg = Config.load();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getSheet_(ss);
    const existing = readExisting_(sheet);
    const byYm = {};
    existing.forEach((r) => { byYm[r.ym] = r; });
    // 列の並びが変わっていたら、書き込む前に見出し・列数・書式を今のレイアウトに作り直す。
    // 既存の行は見出しの名前で読み終えているので、この後すべて今の並びで書き直される
    if (!layoutMatches_(sheet)) {
      sheet.clearConditionalFormatRules();
      SheetLayout.setup(ss);
    }
    const index = FileIndex.load();
    const skip = new Set(plan.skipYms);
    const result = { months: plan.months, read: 0, skipped: 0, kept: 0, noContract: 0, scanned: plan.scanned };
    const merged = {};

    Object.keys(index.months).sort().forEach((ym) => {
      const prev = byYm[ym];
      if (skip.has(ym) && prev) {
        prev.meta.created = Timesheet.toDate(index.months[ym].created) || prev.meta.created;
        merged[ym] = prev;
        result.skipped++;
        return;
      }
      const outcome = store.get(`row:${ym}`);
      if (outcome && outcome.status === 'read') {
        merged[outcome.row.ym] = outcome.row;
        result.read++;
        return;
      }
      // 索引にあるがもう開けないファイル。次の走査で索引から落ちる
      if (prev) { merged[ym] = prev; result.kept++; }
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
    const contracts = Contracts.load();
    rows.forEach((r) => {
      r.contract = Contracts.find(contracts, r.ym);
      if (!r.contract) result.noContract++;
    });

    writeRows_(sheet, rows);
    // 書き終えてから控える（途中で失敗したら、次の更新でもう一度全て読み直す）
    if (plan.signature) Props.setValue(PKeys.LAST_READ_CONFIG, plan.signature);
    Logger.log('[SummaryService] 索引%sヶ月 / 走査%s / 読込%s / スキップ%s / 据置%s / 契約なし%s → %s行',
      result.months, plan.scanned ? 'あり' : 'なし', result.read, result.skipped, result.kept, result.noContract, rows.length);
    return result;
  };

  /**
   * サマリを1回の実行で更新します（トリガ用。メニューからは進捗ダイアログが prepare → readOne → commit を手順ごとに呼ぶ）。
   * @param full trueなら索引を作り直し、全ての勤務表を読み直す
   * @return { months, read, skipped, kept, noContract, scanned } 件数
   */
  const refresh = (full = false) => {
    const store = memoryStore_();
    const plan = prepare(full, store);
    plan.toRead.forEach((item) => readOne(item, store));
    return commit(plan, store);
  };

  /** 進捗ダイアログの1回の実行ぶんの途中結果を置く場所を返します（runId は実行ごとに作る）。 */
  const stepStore = (runId) => cacheStore_(runId);

  return { refresh, prepare, readOne, commit, stepStore, label: label_ };
})();
