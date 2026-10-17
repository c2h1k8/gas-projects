/**
 * FX の約定メール（DMM FX「注文約定のお知らせ」）から money へ約定を登録する。
 *
 * 文面は「■ 約定内容」の下に「項目 : 値」が並ぶ決まった形なので、支出のメール登録と違い
 * Gemini は使わず文面をそのまま読む（検索条件・項目名などはスクリプトプロパティ FX_FILL_SETTING）：
 *   通貨ペア : 米ﾄﾞﾙ/円 ／ 売買 : 売 ／ 注文方法 : 成行 ／ 取引数量 : 10,000 ／ 約定価格 : 160.226 ／ 注文番号 : …
 *
 * **新規か決済かはメールに書かれていない**（件名も本文も同じ形）。なので money の
 * POST /api/fx/fills に約定として送り、振り分けは money に任せる：反対の売買の未決済が
 * 無ければ必ず新規、あれば「確認待ち」としてポジション照会の札で人が選ぶ。
 * 約定日時も文面に無い＝メールの受信時刻を使う（成行・即時ならほぼ約定の時刻）。
 *
 * 対象は**スター付きのメールだけ**で、登録できたらスターを外す（支出のメール登録と同じ流儀）。
 * 送れなかった・読めなかったメールはスターが残る＝次の実行でもう一度試す。
 */
const MainProcFxFill = (() => {
  const CONFIG = {
    DEBUG: false,
    // 検索条件・本文の項目名・単位・通貨名はスクリプトプロパティ FX_FILL_SETTING（JSON）に置く
    // （支出のメール登録の AUTO_REGIST_SETTING_LIST と同じ流儀＝コードを変えずに運用で直せる）
    get SETTING() { return Props.getJson(PKeys.FX_FILL_SETTING); },
  };

  /**
   * 本文から約定を読む。読めなければ null。
   * 通貨ペアは "USD/JPY" の**名前**で返す（money がマスタから引く＝GAS はコード表を持たない）。
   * @return {{pair, directionCd, lot, price, orderNum}|null}
   */
  const parse = (body, setting) => {
    const { FIELDS, SIDE_BUY, SIDE_SELL, LOT_UNIT, CURRENCY } = setting;
    const kv = {};
    String(body || '').normalize('NFKC').split(/\r?\n/).forEach((line) => {
      const m = line.match(/^\s*([^:：]+?)\s*[:：]\s*(.+?)\s*$/);
      if (m) kv[m[1].replace(/\s/g, '')] = m[2];
    });
    const [a, b] = (kv[FIELDS.PAIR] || '').split('/').map((x) => CURRENCY[x.trim()] || x.trim());
    const pair = a && b ? `${a}/${b}` : '';
    const side = kv[FIELDS.SIDE] || '';
    const directionCd = side.includes(SIDE_BUY) ? '001' : side.includes(SIDE_SELL) ? '002' : '';
    const qty = parseFloat((kv[FIELDS.QTY] || '').replace(/[^\d.]/g, ''));
    const price = parseFloat((kv[FIELDS.PRICE] || '').replace(/[^\d.]/g, ''));
    const orderNum = (kv[FIELDS.ORDER] || '').replace(/\s/g, '');
    if (!pair || !directionCd || !qty || !price || !orderNum) return null;
    return { pair, directionCd, lot: Math.round(qty / (LOT_UNIT || 10000)), price, orderNum };
  };

  return {
    create: () => {
      const setting = CONFIG.SETTING;
      if (!setting || !setting.SEARCH_WORD) {
        Logger.log(`[FxFill] ${PKeys.FX_FILL_SETTING} 未設定のためスキップ`);   // 未設定＝安全に無効
        return;
      }
      const threads = GmailApp.search(setting.SEARCH_WORD);
      if (!threads.length) return;
      const results = { entry: [], pending: [], skip: [], fail: [] };

      for (const thread of threads) {
        for (const message of thread.getMessages()) {
          if (!message.isStarred()) continue;
          const fill = parse(message.getPlainBody(), setting);
          if (!fill) { Logger.log(`[FxFill] 読めない本文: ${message.getSubject()}`); continue; }
          const tradeDate = Utilities.formatDate(message.getDate(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');
          const item = { ...fill, tradeDate };
          if (CONFIG.DEBUG) { Logger.log(JSON.stringify(item)); continue; }
          const r = MoneyApi.registerFxFill(item);
          if (!r) { results.fail.push(item); continue; }   // スターを残す＝次の実行で再挑戦
          if (r.created === false) results.skip.push(item);
          else (r.kind === 'entry' ? results.entry : results.pending).push(item);
          message.unstar();
        }
      }

      // 登録したもの・確認待ち・失敗がある時だけ知らせる（既に入っていた約定だけなら黙る）
      if (!CONFIG.DEBUG && (results.entry.length || results.pending.length || results.fail.length)) {
        LocalUtils.postFlex('FX の約定', NotifyCards.fxFillResult(results, MoneyApi.appUrl('#fx/positions')));
      }
    },
    parse,   // 単体確認用
  };
})();

/**
 * FX の約定メールから money へ登録（単体で回す時）。
 * 通常は CreateHouseholdAccountFromMailAI のトリガーから一緒に呼ばれる。
 */
function CreateFxFillsFromMail() {
  MainProcFxFill.create();
}

/** 文面の読み取りの確認（GAS エディタから手で実行） */
function TestParseFxFillMail() {
  const body = '■ 約定内容\n通貨ペア : 米ﾄﾞﾙ/円\n　　売買 : 売\n注文方法 : 成行\n取引数量 : 10,000\n約定価格 : 160.226\n注文番号 : 126000042537027\n';
  Logger.log(JSON.stringify(MainProcFxFill.parse(body, Props.getJson(PKeys.FX_FILL_SETTING))));
}
