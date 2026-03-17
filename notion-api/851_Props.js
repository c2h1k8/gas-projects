/**
 * PropertiesService をラップした共通ユーティリティ（Map 対応 + キャッシュ対応）
 */
const Props = (function () {
  const scriptProps = PropertiesService.getScriptProperties();

  const _valueCache = new Map();      // 通常キーのキャッシュ
  const _mapCache = new Map();   // Mapキー専用のキャッシュ

  const _stringify = (obj) => JSON.stringify(obj, (_, v) => v instanceof Map ? { dataType: "Map", value: [...v] } : v);
  
  const _parse = (obj) => JSON.parse(obj, (_, v) => v?.dataType === "Map" ? new Map(v.value) : v);

  const _loadMapFromStore = (key) => {
    if (_mapCache.has(key)) return _mapCache.get(key);

    const jsonStr = scriptProps.getProperty(key);
    const map = jsonStr ? _parse(jsonStr) : new Map();
    _mapCache.set(key, map);
    return map;
  }

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

    /** Map を保存 */
    setMap: function (key, map) {
      _mapCache.set(key, map);
      scriptProps.setProperty(key, _stringify(map));
    },

    /** Map を取得 */
    getMap: function (key) {
      return _loadMapFromStore(key);
    },

    /** Map にキーが含まれるかチェック */
    hasMapEntry: function (key, mapKey) {
      const map = _loadMapFromStore(key);
      return map.has(mapKey);
    },

    /** Map にキーと値を追加（上書き） */
    setMapEntry: function (key, mapKey, mapValue) {
      const map = _loadMapFromStore(key);
      map.set(mapKey, mapValue);
      this.setMap(key, map);
    },

    /** Map の特定のキーの値を取得 */
    getMapEntry: function (key, mapKey) {
      const map = _loadMapFromStore(key);
      return map.get(mapKey);
    },

    /** 単一キーの削除 */
    deleteKey: function (key) {
      _valueCache.delete(key);
      _mapCache.delete(key);
      scriptProps.deleteProperty(key);
    },

    /** すべてのプロパティを取得（キャッシュ無視） */
    getAllValues: function () {
      return scriptProps.getProperties();
    },

    /** すべて削除（キャッシュもクリア） */
    clearAll: function () {
      _valueCache.clear();
      _mapCache.clear();
      scriptProps.deleteAllProperties();
    },

     /** キャッシュの再同期（外部変更対応） */
    sync: function () {
      _valueCache.clear();
      _mapCache.clear();
    },
  };
})();