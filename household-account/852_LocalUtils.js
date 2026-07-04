const LocalUtils = (function () {
  return {
    postText: (message, emojis = []) => {
      LineUtil.postText(Props.getValue(PKeys.LINE_CHANNEL_TOKEN), Props.getValue(PKeys.LINE_USER_ID), message, emojis);
    },
    postFlex: (altText, contents) => {
      LineUtil.postFlex(Props.getValue(PKeys.LINE_CHANNEL_TOKEN), Props.getValue(PKeys.LINE_USER_ID), altText, contents);
    },
  };
})();
