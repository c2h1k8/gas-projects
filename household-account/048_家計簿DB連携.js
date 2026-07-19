/**
 * 家計簿DB（money API）連携。
 *
 * 新規の支出/収入は money API へ「未確認(CONFIRMED=0)」で登録する
 * （Notion からカットオーバー済み）。money 側は画面の「未確認」タブで
 * 確認・確定するまで本体集計に入らない。
 * カテゴリ/支払先/支払方法は「名前」で送り、サーバが既存マスタからコード解決する
 * （無ければ NULL＝確定時に割り当て）。ペイロードは Notion のページ構造とは独立。
 *
 * 設定（スクリプトプロパティ）:
 *   MONEY_API_URL   … 例 https://your-money-api.example.com
 *   MONEY_API_TOKEN … Bearer トークン
 * 未設定なら送信はスキップ（null 返却）＝安全に無効化できる。
 */
const MoneyApi = (() => {
  const _fmtDate = (d) => {
    if (!d) return null;
    if (Object.prototype.toString.call(d) === '[object Date]') {
      return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    }
    return String(d).slice(0, 10); // 'YYYY-MM-DD' or 'YYYY-MM-DDT...'
  };

  const _creds = () => {
    const base = Props.getValue(PKeys.MONEY_API_URL);
    const token = Props.getValue(PKeys.MONEY_API_TOKEN);
    if (!base || !token) {
      Logger.log('[MoneyApi] URL/TOKEN 未設定のため送信スキップ');
      return null;
    }
    return { base, token };
  };

  const _request = (method, path, payload) => {
    const c = _creds();
    if (!c) return null;
    const opt = {
      method,
      contentType: 'application/json',
      headers: { Authorization: `Bearer ${c.token}` },
      muteHttpExceptions: true,
    };
    if (payload !== undefined) opt.payload = JSON.stringify(payload);
    const res = UrlFetchApp.fetch(`${c.base}${path}`, opt);
    return { code: res.getResponseCode(), text: res.getContentText() };
  };

  // 登録系: 成功時は作成された uuid（文字列）を返す。失敗/未設定は null。
  const _register = (kind, payload, label) => {
    const r = _request('post', `/api/${kind}`, payload);
    if (!r) return null;
    const ok = r.code >= 200 && r.code < 300;
    Logger.log(`[MoneyApi] ${kind} ${label} -> ${r.code}${ok ? '' : ' ' + r.text}`);
    if (!ok) return null;
    try { return JSON.parse(r.text).uuid || null; } catch (e) { return null; }
  };

  /**
   * 支出を「未確認」で登録する。confirmed は送らない＝サーバ既定(未確認0)。
   * @return {string|null} 作成された uuid（成功時）
   */
  const registerSpending = ({ name, date, amount, category, methodPay, payee, url, note, expenseRatio, fixedCostId, fixedCostYm }) =>
    _register('spending', {
      date: _fmtDate(date), name, amount,
      category: category || null, method_pay: methodPay || null, payee: payee || null,
      url: url || null, note: note || null, expense_ratio: expenseRatio || 0,
      fixed_cost_id: fixedCostId || null, fixed_cost_ym: fixedCostYm || null,
    }, name);

  /** 収入を「未確認」で登録する。 @return {string|null} uuid */
  const registerIncome = ({ name, date, amount, fixedCostId, fixedCostYm }) =>
    _register('income', {
      date: _fmtDate(date), name, amount,
      fixed_cost_id: fixedCostId || null, fixed_cost_ym: fixedCostYm || null,
    }, name);

  /**
   * 支出を検索する（DSL: POST /api/spending/search）。
   * 名前/カテゴリ/支払先/支払方法/期間/未確認を **すべてサーバ側で絞り込む**
   * @param {object} cond {uuid, title, nameEndsWith, category, methodPay, payee, from, to, unfinished}
   * @return {Array<object>} /api/spending items（日付降順・金額昇順）
   */
  const searchSpending = (cond) => {
    cond = cond || {};
    const filters = [];
    if (cond.uuid) filters.push({ field: 'uuid', operator: 'eq', value: cond.uuid });
    if (cond.from) filters.push({ field: 'date', operator: 'gte', value: _fmtDate(cond.from) });
    if (cond.to) filters.push({ field: 'date', operator: 'lte', value: _fmtDate(cond.to) });
    if (cond.title) filters.push({ field: 'name', operator: 'eq', value: cond.title });
    if (cond.nameEndsWith) filters.push({ field: 'name', operator: 'endsWith', value: cond.nameEndsWith });
    if (cond.category) filters.push({ field: 'category', operator: 'eq', value: cond.category });
    if (cond.methodPay) filters.push({ field: 'method_pay', operator: 'eq', value: cond.methodPay });
    if (cond.payee) filters.push({ field: 'payee', operator: 'eq', value: cond.payee });
    if (cond.unfinished) filters.push({ field: 'confirmed', operator: 'eq', value: 0 });
    const r = _request('post', '/api/spending/search', { filters, sort: ['-date', 'amount'] });
    if (!r || r.code < 200 || r.code >= 300) return [];
    try { return JSON.parse(r.text).items || []; } catch (e) { return []; }
  };

  /**
   * 収入を検索する（DSL: POST /api/income/search）。名前/期間/未確認をサーバ側で絞り込む。
   * @param {object} cond {title, from, to, unfinished}
   * @return {Array<object>} /api/income items（日付降順・金額昇順）
   */
  const searchIncome = (cond) => {
    cond = cond || {};
    const filters = [];
    if (cond.from) filters.push({ field: 'date', operator: 'gte', value: _fmtDate(cond.from) });
    if (cond.to) filters.push({ field: 'date', operator: 'lte', value: _fmtDate(cond.to) });
    if (cond.title) filters.push({ field: 'name', operator: 'eq', value: cond.title });
    if (cond.unfinished) filters.push({ field: 'confirmed', operator: 'eq', value: 0 });
    const r = _request('post', '/api/income/search', { filters, sort: ['-date', 'amount'] });
    if (!r || r.code < 200 || r.code >= 300) return [];
    try { return JSON.parse(r.text).items || []; } catch (e) { return []; }
  };

  const _update = (kind, uuid, payload, label) => {
    const r = _request('patch', `/api/${kind}/${uuid}`, payload);
    const ok = !!r && r.code >= 200 && r.code < 300;
    Logger.log(`[MoneyApi] update ${kind} ${label} -> ${r ? r.code : 'skip'}${(ok || !r) ? '' : ' ' + r.text}`);
    return ok;
  };
  /** 支出を更新する（カテゴリ/支払先/支払方法は名前でOK＝サーバ解決）。@return {boolean} */
  const updateSpending = (uuid, { name, date, amount, category, methodPay, payee, url, note, expenseRatio }) =>
    _update('spending', uuid, {
      date: _fmtDate(date), name, amount,
      category: category || null, method_pay: methodPay || null, payee: payee || null,
      url: url || null, note: note || null, expense_ratio: expenseRatio || 0,
    }, name);
  /** 収入を更新する。@return {boolean} */
  const updateIncome = (uuid, { name, date, amount }) =>
    _update('income', uuid, { date: _fmtDate(date), name, amount }, name);

  /** 支出を削除する。@return {boolean} */
  const deleteSpending = (uuid) => {
    const r = _request('delete', `/api/spending/${uuid}`);
    return !!r && r.code >= 200 && r.code < 300;
  };
  /** 収入を削除する。@return {boolean} */
  const deleteIncome = (uuid) => {
    const r = _request('delete', `/api/income/${uuid}`);
    return !!r && r.code >= 200 && r.code < 300;
  };

  /**
   * スプレッドシート マスタ更新用の名称リストを取得する。
   * @return {object} {spendingNames, incomeNames, categories, payees, methodPay}
   */
  const getMasters = () => {
    const r = _request('get', '/api/masters');
    if (!r || r.code < 200 || r.code >= 300) return {};
    try { return JSON.parse(r.text) || {}; } catch (e) { return {}; }
  };

  /**
   * 固定費 自動登録の定義一覧を取得する（旧スプレッドシート「固定費自動登録」の代替）。
   * money 側（マスタ管理タブ）で編集した定義を読み、GAS が対象日に登録する。
   * @return {Array<object>} [{id,enabled,type,title,amount,category,payee,methodPay,
   *   note,expenseRatio,months,day,bizAdjust,yearInterval,yearAnchor,validFrom,validTo,createdYm}]
   */
  const getFixedCosts = () => {
    const r = _request('get', '/api/fixed-costs');
    if (!r || r.code < 200 || r.code >= 300) return [];
    try { return JSON.parse(r.text) || []; } catch (e) { return []; }
  };

  return {
    registerSpending, registerIncome,
    searchSpending, searchIncome,
    updateSpending, updateIncome,
    deleteSpending, deleteIncome,
    getMasters,
    getFixedCosts,
  };
})();
