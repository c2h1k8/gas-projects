/**
 * PropertiesService をラップした共通ユーティリティ（Map 対応 + キャッシュ対応）
 */
const Props = (function () {
  const scriptProps = PropertiesService.getScriptProperties();

  const _valueCache = new Map();
  const _jsonCache = new Map();

  const _loadJsonFromStore = (key) => {
    if (_jsonCache.has(key)) return _jsonCache.get(key);

    const jsonStr = scriptProps.getProperty(key);
    const value = jsonStr ? CoreUtils.jsonParse(jsonStr) : null;
    _jsonCache.set(key, value);
    return value;
  };

  return {
    /** 単一キーの保存 */
    setValue: function (key, value) {
      _valueCache.set(key, value);
      scriptProps.setProperty(key, value);
    },

    /** 複数キーの保存 */
    setValues: function (obj) {
      for (const key in obj) {
        _valueCache.set(key, obj[key]);
      }
      scriptProps.setProperties(obj);
    },

    /** 単一キーの取得（キャッシュあり） */
    getValue: function (key) {
      if (_valueCache.has(key)) return _valueCache.get(key);

      const val = scriptProps.getProperty(key);
      _valueCache.set(key, val);
      return val;
    },

    /** JSON シリアライズ可能な値を保存（Map も対応） */
    setJson: function (key, value) {
      _jsonCache.set(key, value);
      scriptProps.setProperty(key, CoreUtils.jsonStringify(value));
    },

    /** JSON 値を取得 */
    getJson: function (key) {
      return _loadJsonFromStore(key);
    },

    /** JSON 値のキーが含まれるかチェック */
    hasJsonEntry: function (key, entryKey) {
      const value = _loadJsonFromStore(key);
      return value instanceof Map ? value.has(entryKey) : false;
    },

    /** JSON 値にキーと値を追加（Map のみ対応） */
    setJsonEntry: function (key, entryKey, entryValue) {
      const value = _loadJsonFromStore(key) || new Map();
      value.set(entryKey, entryValue);
      this.setJson(key, value);
    },

    /** JSON 値の特定キーの値を取得（Map のみ対応） */
    getJsonEntry: function (key, entryKey) {
      const value = _loadJsonFromStore(key);
      return value instanceof Map ? value.get(entryKey) : undefined;
    },

    /** 単一キーの削除 */
    deleteKey: function (key) {
      _valueCache.delete(key);
      _jsonCache.delete(key);
      scriptProps.deleteProperty(key);
    },

    /** すべてのプロパティを取得（キャッシュ無視） */
    getAllValues: function () {
      return scriptProps.getProperties();
    },

    /** すべて削除（キャッシュもクリア） */
    clearAll: function () {
      _valueCache.clear();
      _jsonCache.clear();
      scriptProps.deleteAllProperties();
    },

    /** キャッシュの再同期（外部変更対応） */
    sync: function () {
      _valueCache.clear();
      _jsonCache.clear();
    },
  };
})();
