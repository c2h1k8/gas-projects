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

  return {
    open: (hint = '処理中…', opts = {}) => {
      const w = opts.width ?? DEFAULT_SIZE.w;
      const h = opts.height ?? DEFAULT_SIZE.h;

      setState({ status: 'loading', hint });

      const html = HtmlService.createHtmlOutputFromFile('860_loading')
        .setWidth(w)
        .setHeight(h);

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

      const w = opts.width ?? DEFAULT_SIZE.w;
      const h = opts.height ?? DEFAULT_SIZE.h;

      const html = HtmlService.createHtmlOutput(
        '<script>google.script.host.close();</script>'
      ).setWidth(w).setHeight(h);

      SpreadsheetApp.getUi().showModalDialog(html, ' ');
    },

    getStateForClient: () => getState(),
  };
})();

/**
 * ローディング表示つきで処理を実行する共通ラッパー
 * @param {Function} fn 実行する処理（同期でもOK）
 * @param {Object} opts 表示文言など
 * @return {any} fn の戻り値
 */
function withLoading(fn, opts) {
  opts = opts || {};
  var startHint = opts.startHint || '処理中…';
  var successHint = opts.successHint || '完了しました';
  var errorPrefix = (opts.errorPrefix != null) ? opts.errorPrefix : 'エラー: ';

  LoadingUI.open(startHint);

  try {
    // Apps Scriptのサーバー側は基本同期なので、Promise対応より「同期/非同期どっちでもOK」にしておく
    var result = fn();

    // fnがPromiseを返すケースにも対応
    if (result && typeof result.then === 'function') {
      return result.then(function (v) {
        LoadingUI.complete(successHint);
        return v;
      }).catch(function (e) {
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

function LoadingUi_getStateForClient() {
  return LoadingUI.getStateForClient();
}