class DbNotFoundException extends Error {
  constructor(...params){
    super(...params);
    this.name = "DbNotFoundException";

    // ES6(ES2015)のスタックトレースの保持
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
    // ES5以前のスタックトレースの保持
    Object.setPrototypeOf(this, new.target.prototype);
  }
}