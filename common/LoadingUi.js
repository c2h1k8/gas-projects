/**
 * 処理中のローディング表示（Loading.html）。
 *
 * 1回のサーバー実行の中で終わる処理を、既存のコードを包むだけで「処理中」として見せるための部品です。
 * 処理側が LoadingUI.hint() などで状態をユーザーキャッシュに書き、ダイアログが 0.4 秒ごとに読みに来ます。
 * 手順が事前に分かっている・時間が長い・確認や結果の表が要る処理は StepDialog を使います。
 *
 *   LoadingUI.open('検索中…')              ダイアログを開く（状態を初期化）
 *   LoadingUI.hint('データを取得しています…') 今の作業を変える。前の作業は「済み」として下に残る
 *   LoadingUI.progress(3, 24, '…')         件数が分かるときは進捗バーを件数で進める（文言は任意）
 *   LoadingUI.complete('完了しました')       完了。少し見せてから自動で閉じる（{ autoClose: false } で閉じずに残す）
 *   LoadingUI.error('…')                   失敗。理由を出したまま閉じずに残す
 *   withLoading(fn, { startHint, successHint, errorPrefix, autoClose })  上をまとめて包む
 */
const LoadingUI = (() => {
  const KEY = 'LOADING_UI_STATE';
  const TTL = 60 * 60; // 長い処理でも途中で状態が消えないよう1時間持たせる
  const HISTORY_MAX = 50;
  const DEFAULT_SIZE = { w: 420, h: 420 };
  // 読み込み時にサービスを呼ばない（onOpen などのシンプルトリガーでも全ファイルが読み込まれるため）
  const cache = () => CacheService.getUserCache();

  const setState = (state) => {
    cache().put(KEY, JSON.stringify({ ...state, ts: Date.now() }), TTL);
  };

  const getState = () => {
    const raw = cache().get(KEY);
    if (!raw) return { status: 'idle', hint: '', history: [] };
    try {
      return JSON.parse(raw);
    } catch (e) {
      return { status: 'idle', hint: '', history: [] };
    }
  };

  /** 今の作業を「済み」として履歴に積み、次の状態にします。 */
  const advance_ = (cur, next) => {
    const history = (cur.history || []).slice();
    if (cur.hint && cur.hint !== next.hint) history.push({ text: cur.hint, at: Date.now() });
    return { ...cur, ...next, history: history.slice(-HISTORY_MAX) };
  };

  const resolveSize = (opts = {}) => ({
    w: opts.width ?? DEFAULT_SIZE.w,
    h: opts.height ?? DEFAULT_SIZE.h,
  });

  return {
    open: (hint = '処理中…', opts = {}) => {
      const { w, h } = resolveSize(opts);
      setState({ status: 'loading', hint, title: opts.title || '', history: [], startedAt: Date.now(), current: null, total: null });
      const html = HtmlService.createHtmlOutputFromFile('Loading').setWidth(w).setHeight(h);
      SpreadsheetApp.getUi().showModalDialog(html, ' ');
    },

    hint: (hint) => {
      const cur = getState();
      if (!hint || hint === cur.hint) return;
      setState(advance_(cur, { status: cur.status === 'idle' ? 'loading' : cur.status, hint }));
    },

    progress: (current, total, hint) => {
      const cur = getState();
      setState(advance_(cur, { status: 'loading', current, total, hint: hint || cur.hint }));
    },

    complete: (hint = '完了しました', opts = {}) => {
      const cur = getState();
      setState(advance_(cur, { status: 'complete', hint, autoClose: opts.autoClose !== false, closeDelayMs: opts.delayMs || 1800 }));
    },

    error: (hint = 'エラーが発生しました') => {
      const cur = getState();
      setState(advance_(cur, { status: 'error', hint }));
    },

    close: (opts = {}) => {
      cache().remove(KEY);
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
 * @param {Object} opts { startHint, successHint, errorPrefix, autoClose }
 * @returns {any} fn の戻り値
 */
function withLoading(fn, opts) {
  const o = opts || {};
  const startHint = o.startHint || '処理中…';
  const successHint = o.successHint || '完了しました';
  const errorPrefix = o.errorPrefix != null ? o.errorPrefix : '';
  const completeOpts = { autoClose: o.autoClose !== false };

  LoadingUI.open(startHint, { title: o.title });

  try {
    const result = fn();

    if (result && typeof result.then === 'function') {
      return result.then((v) => {
        LoadingUI.complete(successHint, completeOpts);
        return v;
      }).catch((e) => {
        LoadingUI.error(errorPrefix + (e && e.message ? e.message : String(e)));
        throw e;
      });
    }

    LoadingUI.complete(successHint, completeOpts);
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
