const LockUtil = (() => {
  const LOCK_PREFIX = '__LOCK__';
  const EXPIRY_MS = 3000;

  function _lockKey(name) {
    return `${LOCK_PREFIX}_${name}`;
  }

  return {
    tryLock: function (name) {
      const key = _lockKey(name);
      const now = Date.now();
      const existing = Props.getValue(key);
      if (existing && now - Number(existing) < EXPIRY_MS) {
        return false; // ロック中
      }
      Props.setValue(key, now);
      return true;
    },

    releaseLock: function (name) {
      Props.deleteKey(_lockKey(name));
    },

    withLock: function (name, fn) {
      if (!this.tryLock(name)) {
        throw new Error(`Function [${name}] is currently locked.`);
      }
      try {
        return fn();
      } finally {
        this.releaseLock(name);
      }
    }
  };
})();
