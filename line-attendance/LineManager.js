const LineManager = (function () {
  
  const getToken = () => {
    return Props.getValue(PKeys.LINE_CHANNEL_TOKEN);
  }
  const getUserId = () => {
    return Props.getValue(PKeys.LINE_USER_ID);
  }

  return {
    post: function(msg, emojis) {
      LineUtil.postText(getToken(), getUserId(), msg, emojis);
    },
    reply: function(replyToken, msg, emojis) {
      if (replyToken) {
        LineUtil.replyText(getToken(), replyToken, msg, emojis);
      } else {
        this.post(msg, emojis);
      }
    },
    postQuick: function(msg, acitons) {
      LineUtil.postQuickText(getToken(), getUserId(), msg, acitons);
    },
    replyQuick: function(replyToken, msg, acitons) {
      if (replyToken) {
        LineUtil.replyQuickText(getToken(), replyToken, msg, acitons);
      } else {
        this.postQuick(msg, acitons);
      }
    },
    getBeginnerMark: function() {
      return LineUtil.getEmojiJson('5ac21a18040ab15980c9b43e', '018');
    },
    getHappinessMark: function() {
      return LineUtil.getEmojiJson('5ac1bfd5040ab15980c9b435', '002');
    },
    getAngryMark: function() {
      return LineUtil.getEmojiJson('5ac1bfd5040ab15980c9b435', '007');
    },
    getNgMark: function() {
      return LineUtil.getEmojiJson('5ac21a18040ab15980c9b43e', '068');
    },
  };
})();