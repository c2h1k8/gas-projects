/**
 * 勤務表ファイルの索引。
 *
 * 年月とファイルIDの対応をスクリプトプロパティに残し、
 * 毎回フォルダを走査しなくても各月の勤務表を開けるようにします。
 *
 * 走査するかどうかは「集計開始年月〜当月」のうち索引に無い月があるかで決めます。
 * 勤務表は月に1つ増えるだけなので、揃っている間は走査そのものが要りません。
 * 揃っていない場合でも走査は1日1回までにします（その月の勤務表がまだ作られて
 * いないだけのときに、毎回フォルダを舐めても見つかるものが無いためです）。
 */
const FileIndex = (function () {
  /** 索引を読み込みます（無ければ空の形で返す）。 */
  const load = () => {
    const raw = Props.getJson(PKeys.FILE_INDEX);
    return {
      months: (raw && raw.months) || {},
      ignored: (raw && raw.ignored) || [],
      scannedAt: (raw && raw.scannedAt) || '',
    };
  };

  /** 索引を保存します。 */
  const save = (index) => Props.setJson(PKeys.FILE_INDEX, index);

  /** 索引を消します（作り直したいとき用）。 */
  const clear = () => Props.deleteKey(PKeys.FILE_INDEX);

  /** 'yyyyMM' の翌月を返します。 */
  const nextYm = (ym) => {
    const y = Number(ym.slice(0, 4));
    const m = Number(ym.slice(4));
    return DateUtils.formatDate(new Date(y, m, 1), 'yyyyMM');
  };

  /** 索引に入っている最も古い年月を返します（空なら''）。 */
  const oldestYm = (index) => Object.keys(index.months).sort()[0] || '';

  /**
   * フォルダの走査が要るかを判定します。
   * @param cfg 設定
   * @param index 索引
   * @param full 全期間の再集計か（この場合は必ず走査する）
   */
  const needsScan = (cfg, index, full) => {
    if (full) return true;
    if (!Object.keys(index.months).length) return true;

    const nowYm = Timesheet.ym(new Date());
    const start = cfg.fromYm || oldestYm(index);
    let missing = false;
    for (let ym = start; ym <= nowYm; ym = nextYm(ym)) {
      if (!index.months[ym]) { missing = true; break; }
    }
    if (!missing) return false;

    // 欠けている月があっても、今日すでに走査していれば繰り返さない
    return index.scannedAt !== DateUtils.formatDate(new Date(), 'yyyy-MM-dd');
  };

  /**
   * フォルダを走査して索引を作り直します。
   *
   * 年月はファイルを開いて確かめる必要があるため、索引に無いファイルだけを開きます。
   * 開いた結果はそのまま呼び出し側へ渡し、同じファイルを二度開かないようにします。
   *
   * @param cfg 設定
   * @param selfId このスプレッドシート自身のID（対象外）
   * @return { index, metaById, dataById }
   */
  const scan = (cfg, selfId) => {
    const prev = load();
    const knownYmById = {};
    Object.keys(prev.months).forEach((ym) => { knownYmById[prev.months[ym].id] = ym; });
    const ignored = {};
    prev.ignored.forEach((id) => { ignored[id] = true; });

    const files = Timesheet.listFiles(cfg.dirId, selfId, cfg.excludeNames);
    const months = {};
    const metaById = {};
    const dataById = {};

    files.forEach((file) => {
      metaById[file.id] = file;

      // 既に年月が分かっているファイルは開かない
      const known = knownYmById[file.id];
      if (known) {
        months[known] = { id: file.id, created: file.created };
        return;
      }
      // 勤務表として読めないと分かっているファイルも開かない
      if (ignored[file.id]) return;

      const data = Timesheet.readMonth(file.id, cfg);
      if (!data) {
        ignored[file.id] = true;
        return;
      }
      months[data.ym] = { id: file.id, created: file.created };
      dataById[file.id] = data;
    });

    // 走査で見つからなかったファイルは索引から落とす（消された勤務表を残さないため）
    const index = {
      months,
      ignored: Object.keys(ignored).filter((id) => !!metaById[id]),
      scannedAt: DateUtils.formatDate(new Date(), 'yyyy-MM-dd'),
    };
    save(index);
    Logger.log('[FileIndex] 走査: 対象%s件 / 索引%sヶ月 / 対象外%s件',
      files.length, Object.keys(months).length, index.ignored.length);
    return { index, metaById, dataById };
  };

  return { load, save, clear, needsScan, nextYm, oldestYm, scan };
})();
