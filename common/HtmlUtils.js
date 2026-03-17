const HtmlUtils = (function () {
  return {
    /**
     * HTMLから指定した開始文字と終了文字の間の文字列配列を取得します。
     * @param {string} html HTMLテキスト
     * @param {string} from 開始文字
     * @param {string} to 終了文字
     * @returns {string[]} 抽出文字列配列
     */
    getElements: (html, from, to) => {
      return Parser.data(html).from(from).to(to).iterate();
    },

    /**
     * HTMLから指定した開始文字と終了文字の間の文字列を取得します。
     * @param {string} html HTMLテキスト
     * @param {string} from 開始文字
     * @param {string} to 終了文字
     * @returns {string} 抽出文字列
     */
    getElement: (html, from, to) => {
      return Parser.data(html).from(from).to(to).build();
    },
  };
})();
