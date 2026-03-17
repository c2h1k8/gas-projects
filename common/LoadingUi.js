const LoadingUI = (() => {
  const CACHE = CacheService.getUserCache();
  const KEY = 'LOADING_UI_STATE';
  const DEFAULT_SIZE = { w: 360, h: 360 };

  const setState = (state) => {
    CACHE.put(KEY, JSON.stringify({ ...state, ts: Date.now() }), 300);
  };

  const getState = () => {
    const raw = CACHE.get(KEY);
    if (!raw) return { status: 'idle', hint: '' };
    try {
      return JSON.parse(raw);
    } catch (e) {
      return { status: 'idle', hint: '' };
    }
  };

  const resolveSize = (opts = {}) => ({
    w: opts.width ?? DEFAULT_SIZE.w,
    h: opts.height ?? DEFAULT_SIZE.h,
  });

  return {
    open: (hint = '処理中…', opts = {}) => {
      const { w, h } = resolveSize(opts);
      setState({ status: 'loading', hint });
      const html = HtmlService.createHtmlOutputFromFile('Loading').setWidth(w).setHeight(h);
      SpreadsheetApp.getUi().showModalDialog(html, ' ');
    },

    hint: (hint) => {
      const cur = getState();
      setState({ ...cur, status: cur.status === 'idle' ? 'loading' : cur.status, hint });
    },

    complete: (hint = '完了しました') => {
      const cur = getState();
      setState({ ...cur, status: 'complete', hint });
    },

    error: (hint = 'エラーが発生しました') => {
      const cur = getState();
      setState({ ...cur, status: 'error', hint });
    },

    close: (opts = {}) => {
      CACHE.remove(KEY);
      const { w, h } = resolveSize(opts);
      const html = HtmlService.createHtmlOutput('<script>google.script.host.close();</script>').setWidth(w).setHeight(h);
      SpreadsheetApp.getUi().showModalDialog(html, ' ');
    },

    getStateForClient: () => getState(),
  };
})();

/**
 * ローディング表示つきで処理を実行する共通ラッパー
 * @param {Function} fn 実行する処理
 * @param {Object} opts 表示文言など
 * @returns {any} fn の戻り値
 */
function withLoading(fn, opts) {
  const o = opts || {};
  const startHint = o.startHint || '処理中…';
  const successHint = o.successHint || '完了しました';
  const errorPrefix = o.errorPrefix != null ? o.errorPrefix : 'エラー: ';

  LoadingUI.open(startHint);

  try {
    const result = fn();

    if (result && typeof result.then === 'function') {
      return result.then((v) => {
        LoadingUI.complete(successHint);
        return v;
      }).catch((e) => {
        LoadingUI.error(errorPrefix + (e && e.message ? e.message : String(e)));
        throw e;
      });
    }

    LoadingUI.complete(successHint);
    return result;

  } catch (e) {
    LoadingUI.error(errorPrefix + (e && e.message ? e.message : String(e)));
    throw e;
  }
}

// GAS クライアントサイドから呼び出し可能なエントリーポイント
function LoadingUi_getStateForClient() {
  return LoadingUI.getStateForClient();
}
