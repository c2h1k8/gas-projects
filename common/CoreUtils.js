const CoreUtils = (function () {
  return {
    jsonStringify: (obj) => JSON.stringify(obj, (k, v) => (v instanceof Map ? { dataType: 'Map', value: [...v] } : v)),
    jsonParse: (obj) => {
      return JSON.parse(obj, (k, v) => {
        if (typeof v === "object" && v !== null) {
          if (v.dataType === "Map") {
            return new Map(v.value);
          }
        }
        return v;
      });
    },
    sort: (array, sortMap) => {
      array.sort((a, b) => {
        for (const [idx, isAsc] of sortMap) {
          let ret = isAsc ? 1 : -1;
          if (a[idx] > b[idx]) return ret;
          if (a[idx] < b[idx]) return -ret;
        }
        return 0;
      });
    },
  };
})();
